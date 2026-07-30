# Electron Forge mapping

Use the existing Forge configuration style. Typical mappings:

```ts
packagerConfig: {
  name: 'CarbonCast IPTV',
  icon: path.resolve(__dirname, 'resources/icons/app-icon'), // extension omitted
},
makers: [
  new MakerSquirrel({
    name: 'carboncast_iptv',
    setupIcon: path.resolve(__dirname, 'resources/icons/app-icon.ico'),
    iconUrl: 'file://' + path.resolve(__dirname, 'resources/icons/app-icon.ico'),
  }),
]
```

Update paths to match the repository. Do not paste this blindly over an existing config.
