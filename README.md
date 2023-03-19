# TS Plugins
[![npm (scoped)](https://img.shields.io/npm/v/@cheatoid/ts-plugins?style=for-the-badge)](https://www.npmjs.com/package/@cheatoid/ts-plugins)

General-purpose [TypeScript](https://github.com/microsoft/TypeScript) plugins/transformers.

## 🛠 Installation
Get the latest package from npm:
```shell
npm install -D @cheatoid/ts-plugins
# or
yarn add -D @cheatoid/ts-plugins
```

## ✨ Features

Note: Each feature works on opt-in basis.  
Modify your `tsconfig.json` (replace the `INSERT-TRANSFORM-NAME` accordingly):  
```json
{
    "compilerOptions": {
        "plugins": [
            { "transform": "@cheatoid/ts-plugins/INSERT-TRANSFORM-NAME.js" },
        ]
    }
}
```

### ***Constant Folding***
`{ "transform": "@cheatoid/ts-plugins/constant-folding.js" }`

See [Wikipedia](https://en.wikipedia.org/wiki/Constant_folding) for explanation.

#### Additional Options
`evaluateMath`: Set to `true` to enable `Math` library evaluation (when possible).
