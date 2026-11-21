# Portal Operacional SMI

Portal corporativo com autenticação via Discord e controle de acesso por cargos.

## 🔗 URLs úteis

- Discord Developer Portal: https://discord.com/developers/applications
- Servidor configurado: `1329544134272356512`
- App criado: `1573684369279946782`

## ⚙️ Configuração obrigatória

Antes de publicar, edite o arquivo `index.html` e confirme a `REDIRECT_URI`:

```javascript
const REDIRECT_URI = 'https://seuusuario.github.io/portal-smi';
```

Depois cadastre a **mesma URL** no Discord:

1. Acesse [Discord Developer Portal](https://discord.com/developers/applications)
2. Selecione o app **smi**
3. Vá em **OAuth2** → **Redirects**
4. Clique em **Add Redirect** e cole a URL do seu site
5. Salve

## 🚀 Publicação no GitHub Pages

1. Crie um repositório no GitHub (ex: `portal-smi`)
2. Envie os arquivos `index.html`, `README.md` e a pasta `.github/workflows/`
3. Vá em **Settings** → **Pages**
4. Em **Source**, selecione **GitHub Actions**
5. O workflow fará o deploy automaticamente

## 👤 Permissões

| Tipo | ID | Acesso |
|---|---|---|
| Administrador | `552947639025401888` | Painel completo: logins, membros, materiais |
| Cargo permitido 1 | `1329545094163988510` | Acesso ao portal |
| Cargo permitido 2 | `1412247141505699981` | Acesso ao portal |

## ⚠️ Limitações da versão estática

Sem backend, algumas funções do painel administrativo funcionam apenas em memória durante a sessão:

- Exportar logins em CSV ✅
- Adicionar/remover membros (simulação visual) ⚠️
- Publicar/remover materiais (simulação visual) ⚠️

Para funcionalidades reais em tempo real (banco de dados, adicionar membros no Discord automaticamente), será necessário um backend com Node.js/Express + banco de dados + bot do Discord.

## 📁 Estrutura

```
portal-smi/
├── .github/
│   └── workflows/
│       └── deploy.yml
├── index.html
└── README.md
```