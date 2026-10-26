#!/usr/bin/env python3
import io
import os
import struct
import sys
import types
import zlib
from pathlib import Path

# UnityPy may import its audio converter while handling a texture. The web
# service does not process audio, so avoid initializing FMOD unnecessarily.
if "fmod_toolkit" not in sys.modules:
    fmod_stub = types.ModuleType("fmod_toolkit")
    setattr(fmod_stub, "raw_to_wav", None)
    setattr(fmod_stub, "sound_to_wav", None)
    setattr(fmod_stub, "subsound_to_wav", None)
    sys.modules["fmod_toolkit"] = fmod_stub

from flask import Flask, jsonify, render_template, request, send_file
from PIL import Image, UnidentifiedImageError
import UnityPy  # type: ignore[import-not-found]

# Os arquivos da interface ficam disponíveis na raiz para que os caminhos
# /styles.css, /app.js e /manus-routes.json funcionem no Preview e publicado.
app = Flask(__name__, static_folder="public", static_url_path="", template_folder="public")
app.config["MAX_CONTENT_LENGTH"] = 120 * 1024 * 1024

SUPPORTED_TEXTURES = {
    "jake_tex_low",
    "tricky_tex_low",
    "fresh_tex_low",
    "brody_tex_low",
    "ella_tex_low",
}
WRAPPER_PREFIX = b"\x0esubway_bundles"


def save_bundle(env):
    saved = env.file.save(packer="original")
    return saved if isinstance(saved, bytes) else bytes(saved)


def parse_webdata(blob):
    base = blob.find(b"\0") + 1
    if base <= 0:
        raise ValueError("Cabeçalho UnityWebData não encontrado.")
    header_size, = struct.unpack_from("<I", blob, base)
    if header_size < base + 4 or header_size > len(blob):
        raise ValueError("Tabela UnityWebData inválida.")
    pos = base + 4
    entries = []
    while pos < header_size:
        if pos + 12 > header_size:
            raise ValueError("Entrada UnityWebData incompleta.")
        offset, size, path_len = struct.unpack_from("<III", blob, pos)
        pos += 12
        if pos + path_len > header_size:
            raise ValueError("Caminho UnityWebData inválido.")
        path = blob[pos:pos + path_len].decode("utf-8")
        pos += path_len
        if offset + size > len(blob):
            raise ValueError(f"Asset fora dos limites: {path}.")
        entries.append([offset, size, path])
    return base, header_size, entries


def replace_texture(webdata, image_bytes, target_name):
    if target_name not in SUPPORTED_TEXTURES:
        raise ValueError("Textura selecionada não está disponível.")
    is_raw_unityfs = webdata.startswith(b"UnityFS")
    if is_raw_unityfs:
        base = header_size = data_offset = old_data_size = 0
        entries = []
        data_blob = webdata
    else:
        base, header_size, entries = parse_webdata(webdata)
        data_entry = next((e for e in entries if e[2] == "data.unity3d"), None)
        if data_entry is None:
            raise ValueError("O arquivo não contém data.unity3d.")
        data_offset, old_data_size, _ = data_entry
        data_blob = webdata[data_offset:data_offset + old_data_size]
    try:
        image = Image.open(io.BytesIO(image_bytes))
        if image.format != "PNG":
            raise ValueError("A textura precisa estar no formato PNG.")
        if image.size != (256, 256):
            raise ValueError(f"A textura precisa ter 256x256 pixels; recebida: {image.size}.")
        image.load()
        image = image.convert("RGBA")
    except UnidentifiedImageError as exc:
        raise ValueError("O arquivo de textura não é uma PNG válida.") from exc

    env = UnityPy.load(data_blob)
    text_asset = None
    for obj in env.objects:
        try:
            asset = obj.parse_as_object()
        except Exception:
            continue
        if obj.type.name == "TextAsset" and getattr(asset, "m_Name", None) == target_name:
            text_asset = asset
            break
    if text_asset is None:
        raise ValueError(f"TextAsset {target_name} não encontrado em data.unity3d.")

    wrapper = text_asset.m_Script.encode("utf-8", "surrogateescape")
    if not wrapper.startswith(WRAPPER_PREFIX) or len(wrapper) <= 19:
        raise ValueError("O wrapper subway_bundles de jake_tex_low é inválido.")
    try:
        inner_blob = zlib.decompress(wrapper[19:], -15)
    except zlib.error as exc:
        raise ValueError("Não foi possível descompactar o bundle interno de jake_tex_low.") from exc

    inner_env = UnityPy.load(inner_blob)
    texture = None
    for obj in inner_env.objects:
        try:
            asset = obj.parse_as_object()
        except Exception:
            continue
        if obj.type.name == "Texture2D" and getattr(asset, "m_Name", None) == target_name:
            texture = asset
            break
    if texture is None:
        raise ValueError(f"Texture2D {target_name} não encontrada no bundle interno.")

    texture.image = image
    texture.save()
    new_inner = save_bundle(inner_env)

    compressor = zlib.compressobj(level=9, wbits=-15)
    compressed = compressor.compress(new_inner) + compressor.flush()
    new_wrapper = wrapper[:15] + struct.pack("<I", len(new_inner)) + compressed
    text_asset.m_Script = new_wrapper.decode("utf-8", "surrogateescape")
    text_asset.save()

    new_data = save_bundle(env)
    if is_raw_unityfs:
        return new_data

    delta = len(new_data) - old_data_size
    new_entries = []
    for offset, size, path in entries:
        if offset > data_offset:
            offset += delta
        if path == "data.unity3d":
            size = len(new_data)
        new_entries.append((offset, size, path))

    new_header = bytearray(webdata[:header_size])
    pos = base + 4
    for offset, size, path in new_entries:
        encoded = path.encode("utf-8")
        struct.pack_into("<III", new_header, pos, offset, size, len(encoded))
        pos += 12 + len(encoded)

    result = bytes(new_header)
    result += webdata[header_size:data_offset]
    result += new_data
    result += webdata[data_offset + old_data_size:]
    return result


@app.get("/")
def index():
    return render_template("index.html")


@app.post("/api/replace")
def replace_endpoint():
    webdata_file = request.files.get("unityweb")
    texture_file = request.files.get("texture")
    target_name = request.form.get("target", "jake_tex_low")
    if webdata_file is None or texture_file is None:
        return jsonify(error="Selecione o arquivo UnityWebData e a PNG."), 400
    try:
        result = replace_texture(webdata_file.read(), texture_file.read(), target_name)
    except (ValueError, struct.error, zlib.error, OSError) as exc:
        return jsonify(error=str(exc)), 400
    except Exception:
        app.logger.exception("Falha inesperada no processamento")
        return jsonify(error="Falha inesperada ao processar o arquivo. Confira se ele é um bundle Unity válido."), 500

    return send_file(
        io.BytesIO(result),
        mimetype="application/octet-stream",
        as_attachment=True,
        download_name=("data.unity3d.modificado" if result.startswith(b"UnityFS") else "venice.alt.data.unityweb.modificado"),
    )


@app.get("/health")
def health():
    return jsonify(status="ok")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "3000"))
    app.run(host="0.0.0.0", port=port)
