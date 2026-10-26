# Skin Replace — plano

## Objetivo
Criar uma ferramenta web em português brasileiro para receber um `venice.alt.data.unityweb` e uma PNG 256×256, substituir exclusivamente a `Texture2D` `jake_tex_low` dentro do `TextAsset` correspondente e devolver um novo UnityWebData para download.

## Design

Estilos possíveis: painel técnico preto/cinza (0,07); utilitário claro minimalista (0,06); editor visual gamer com gradientes fortes (0,05).

Escolha: painel técnico preto/cinza.

**Design Movement:** interface inspirada em ferramentas de modding e depuração, com superfície escura, bordas discretas e detalhes tons de cinza.

**Core Principles:** foco no fluxo de três passos; feedback de validação sempre visível; linguagem direta; preservação explícita dos assets não alterados.

**Color Philosophy:** fundo grafite reduz distração; cinza claro indica ações e estado válido; cinza médio marca o fluxo de transformação; cinza escuro fica reservado para avisos.

**Layout Paradigm:** coluna principal estreita com cabeçalho de status, dois cartões de entrada lado a lado em telas largas e empilhados no celular, seguida por uma área de ação e resultado.

**Signature Elements:** etiqueta `UNITY / TEXTURE PIPELINE`; linha de progresso segmentada; caixa de preservação com nomes dos assets protegidos.

**Interaction Philosophy:** o botão só fica ativo quando os dois arquivos passam pela validação; durante o processamento fica bloqueado e mostra progresso textual.

**Animation:** transições curtas de 160–220 ms; brilho sutil apenas em foco e sucesso; nenhum movimento contínuo que distraia.

**Typography System:** Inter para interface e JetBrains Mono para nomes de arquivos, assets e mensagens técnicas.

**Brand Essence:** uma bancada segura para trocar texturas Unity sem tocar nos assets errados. Personalidade: precisa, transparente, prática.

**Brand Voice:** “Troque a textura sem mexer no restante.” e “Alvo protegido: somente `jake_tex_low` será alterado.”

**Wordmark & Logo:** wordmark compacto “SKIN / REPLACE” com barra vertical de pipeline.

**Signature Brand Color:** cinza claro `#d4d4d4`.

## Implementação

- Backend Python/Flask em `server.py`, com limite de upload e endpoint `POST /api/replace`.
- Processamento baseado em UnityPy, Pillow e zlib: abre o UnityWebData, encontra `data.unity3d`, abre o TextAsset `jake_tex_low`, descompacta o bundle UnityFS interno, troca apenas sua Texture2D, recompõe os wrappers e atualiza offsets.
- Frontend estático em `public/` com dois campos de arquivo, validação de PNG 256×256, status, avisos e download.
- `requirements.txt` fixa as dependências; `Dockerfile` instala as dependências e inicia o servidor na porta `3000`.
- `public/manus-routes.json` declara a rota `/`.
