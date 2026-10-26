# Skin Replace — entregas

- [x] Interface em português brasileiro com três botões: `Upload archive`, `Replace PNG` e `Download custom PNG`, usando campos de upload ocultos.
  - Critérios: os dois campos são visíveis; nomes e formatos esperados ficam claros; o layout funciona em telas estreitas.

- [x] Validação da imagem para aceitar somente PNG com dimensões exatas de 256×256 pixels.
  - Critérios: a imagem inválida recebe mensagem clara; uma imagem válida mostra confirmação visual.

- [x] Validação do UnityWebData antes do processamento.
  - Critérios: o backend verifica o contêiner, `data.unity3d`, o TextAsset `jake_tex_low` e a Texture2D interna alvo.

- [x] Ação principal para substituir exclusivamente `jake_tex_low`.
  - Critérios: o processamento troca somente `data.unity3d → TextAsset jake_tex_low → Texture2D jake_tex_low`; as variantes de outfit e zombie permanecem sem alteração.

- [x] Estado visual de processamento e mensagens de erro.
  - Critérios: o botão evita envios duplicados; progresso, sucesso e erro são comunicados em português.

- [x] Download do UnityWebData ou `data.unity3d` modificado e prévia da PNG escolhida.
- [x] Dois modos de upload: `Site version` para `.unityweb` e `Android version` para `data.unity3d`.
- [x] Aba Textures com `jake_tex_low`, `tricky_tex_low`, `fresh_tex_low`, `brody_tex_low` e `ella_tex_low`, permitindo selecionar o alvo antes do upload.
  - Critérios: ao concluir, o navegador recebe um arquivo com nome `venice.alt.data.unityweb.modificado`.
