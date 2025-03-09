---
title: Win11切换Win10经典右击菜单栏
date: 2023-07-21 08:19:04
categories: 小玩意儿
tags:
  - Windows
---

相信有不少升级为Win11的小伙伴对Win11的折叠右击菜单非常不舒服，平常只需要一次右击的事情，现在还要展开更多，再去找需要的工具。非常影响使用体验，接下来，告诉大家不用下载任何第三方软件，也不用手动修改注册表，只需要执行两条命令就会自动修改注册表的方法。

### 切换Win10经典右击菜单栏

<kbd>Win</kbd>+<kbd>R</kbd>，输入`cmd`回车，紧接着复制并执行下面两条命令。

<!-- more -->

```bash
reg add "HKCU\Software\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\InprocServer32" /f /ve
```

```bash
taskkill /f /im explorer.exe & start explorer.exe
```

### 恢复Win11右击菜单栏

既然可以切换到Win10的菜单栏，那自然也可以恢复为Win11的菜单栏。同样的，<kbd>Win</kbd>+<kbd>R</kbd>，输入`cmd`回车，紧接着复制并执行下面两条命令。

```bash
reg delete "HKCU\Software\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}" /f
```

```bash
taskkill /f /im explorer.exe & start explorer.exe
```