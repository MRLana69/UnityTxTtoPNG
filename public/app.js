const form = document.querySelector('#replace-form');
const unityInput = document.querySelector('#unityweb-input');
const textureInput = document.querySelector('#texture-input');
const archiveButton = document.querySelector('#archive-button');
const replaceButton = document.querySelector('#replace-button');
const downloadButton = document.querySelector('#download-button');
const unityName = document.querySelector('#unityweb-name');
const textureName = document.querySelector('#texture-name');
const texturePreview = document.querySelector('#texture-preview');
const status = document.querySelector('#status');
const result = document.querySelector('#result');
const downloadLink = document.querySelector('#download-link');
const targetPanel = document.querySelector('#target-panel');
const assetSearch = document.querySelector('#asset-search');
const fileSummary = document.querySelector('#file-summary');
const previewLabel = document.querySelector('#preview-label');
const targetPath = document.querySelector('#target-path');
const assetChips = [...document.querySelectorAll('.asset-chip')];
const selectedTargetLabel = document.querySelector('#selected-target-label');
const uploadTab = document.querySelector('#upload-tab');
const texturesTab = document.querySelector('#textures-tab');
const textureLibrary = document.querySelector('#texture-library');
const uploadView = document.querySelector('#upload-view');
const backUpload = document.querySelector('#back-upload');
const siteMode = document.querySelector('#site-mode');
const androidMode = document.querySelector('#android-mode');
const archiveButtonLabel = document.querySelector('#archive-button-label');
let validTexture = false;
let downloadUrl = null;
let selectedTarget = 'jake_tex_low';
let selectedMode = 'site';

assetSearch.addEventListener('input', () => {
  const query = assetSearch.value.trim().toLowerCase();
  if (targetPanel.hidden) return;
  document.querySelectorAll('.asset-chip, #target-path').forEach((item) => {
    item.classList.toggle('search-hidden', Boolean(query) && !item.textContent.toLowerCase().includes(query));
  });
});

assetChips.forEach((chip) => chip.addEventListener('click', () => {
  selectedTarget = chip.dataset.target;
  assetChips.forEach((item) => item.classList.toggle('selected', item === chip));
  targetPath.textContent = `data.unity3d → TextAsset ${selectedTarget} → Texture2D ${selectedTarget}`;
  selectedTargetLabel.textContent = `alvo atual: ${selectedTarget}`;
  setStatus(`${selectedTarget} selecionado`);
}));

function showTab(tab) {
  const textures = tab === 'textures';
  textureLibrary.hidden = !textures;
  uploadView.hidden = textures;
  uploadTab.classList.toggle('active', !textures);
  texturesTab.classList.toggle('active', textures);
  uploadTab.setAttribute('aria-selected', String(!textures));
  texturesTab.setAttribute('aria-selected', String(textures));
}

uploadTab.addEventListener('click', () => showTab('upload'));
texturesTab.addEventListener('click', () => showTab('textures'));
backUpload.addEventListener('click', () => showTab('upload'));

function setMode(mode) {
  selectedMode = mode;
  const android = mode === 'android';
  siteMode.classList.toggle('active', !android);
  androidMode.classList.toggle('active', android);
  unityInput.accept = android ? '.unity3d,application/octet-stream' : '.unityweb,application/octet-stream';
  archiveButtonLabel.textContent = android ? 'Upload data.unity3d' : 'Upload .unityweb';
  unityInput.value = '';
  unityName.textContent = 'archive não selecionado';
  fileSummary.hidden = true;
  targetPanel.hidden = true;
  replaceButton.hidden = true;
  downloadButton.hidden = true;
  downloadButton.disabled = true;
  form.classList.remove('has-archive');
  setStatus(android ? 'modo Android selecionado' : 'modo Site selecionado');
}

siteMode.addEventListener('click', () => setMode('site'));
androidMode.addEventListener('click', () => setMode('android'));

function setStatus(message, kind = '') {
  status.className = `status ${kind}`.trim();
  status.querySelector('span:last-child').textContent = message;
}

archiveButton.addEventListener('click', () => unityInput.click());
unityInput.addEventListener('change', () => {
  const file = unityInput.files[0];
  const expected = selectedMode === 'android' ? '.unity3d' : '.unityweb';
  if (file && !file.name.toLowerCase().endsWith(expected)) {
    unityInput.value = '';
    setStatus(`no modo atual, envie um arquivo ${expected}`, 'error');
    return;
  }
  unityName.textContent = file ? `archive: ${file.name}` : 'archive não selecionado';
  targetPanel.hidden = !file;
  fileSummary.hidden = !file;
  replaceButton.hidden = !file;
  form.classList.toggle('has-archive', Boolean(file));
  if (file) setStatus(validTexture ? 'pronto para substituir' : 'agora escolha uma PNG');
});

replaceButton.addEventListener('click', () => {
  if (!unityInput.files.length) {
    setStatus('selecione primeiro o archive', 'error');
    return;
  }
  textureInput.click();
});

textureInput.addEventListener('change', () => {
  const file = textureInput.files[0];
  validTexture = false;
  if (!file) return;
  textureName.textContent = `PNG: ${file.name}`;
  if (file.type !== 'image/png' && !file.name.toLowerCase().endsWith('.png')) {
    setStatus('a textura precisa ser PNG', 'error');
    return;
  }
  const previewUrl = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    if (image.width !== 256 || image.height !== 256) {
      URL.revokeObjectURL(previewUrl);
      textureName.textContent = `PNG inválida: ${image.width}×${image.height}`;
      setStatus('a PNG precisa ter exatamente 256×256', 'error');
      return;
    }
    validTexture = true;
    fileSummary.hidden = false;
    texturePreview.src = previewUrl;
    texturePreview.style.display = 'block';
    previewLabel.textContent = `preview · ${image.width}×${image.height} · ${selectedTarget}`;
    setStatus('processando somente jake_tex_low…', 'busy');
    processFiles();
  };
  image.onerror = () => {
    URL.revokeObjectURL(previewUrl);
    setStatus('não foi possível ler a PNG', 'error');
  };
  image.src = previewUrl;
});

async function processFiles() {
  replaceButton.disabled = true;
  archiveButton.disabled = true;
  downloadButton.disabled = true;
  result.hidden = true;
  const body = new FormData();
  body.append('unityweb', unityInput.files[0]);
  body.append('texture', textureInput.files[0]);
  body.append('target', selectedTarget);
  try {
    const response = await fetch('/api/replace', { method: 'POST', body });
    if (!response.ok) {
      let message = 'não foi possível gerar o arquivo';
      try { message = (await response.json()).error || message; } catch (_) {}
      throw new Error(message);
    }
    const blob = await response.blob();
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = URL.createObjectURL(blob);
    downloadLink.href = downloadUrl;
    downloadLink.download = unityInput.files[0].name.toLowerCase().endsWith('.unity3d')
      ? 'data.unity3d.modificado'
      : 'venice.alt.data.unityweb.modificado';
    downloadButton.hidden = false;
    downloadButton.disabled = false;
    result.hidden = false;
    setStatus('replace concluído · download disponível', 'valid');
  } catch (error) {
    setStatus(error.message || 'falha no processamento', 'error');
  } finally {
    replaceButton.disabled = false;
    archiveButton.disabled = false;
  }
}

downloadButton.addEventListener('click', () => {
  if (downloadUrl) downloadLink.click();
  else setStatus('faça o replace antes do download', 'error');
});

form.addEventListener('submit', (event) => event.preventDefault());
