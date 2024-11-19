---
title: .bashrc 不会自动执行
tags:
  - Linux
  - Ubuntu
date: 2024-11-19 15:57:56
categories: 技术
---

今天遇到一个非常奇怪的问题，安装完miniconda之后，执行`source ~/.bashrc`之后，正常终端就应该出现`(base)`的字样，但是一直没有出现，甚至重新开启新的终端也没有生效。

在上网百度了之后，总结出以下的解决方案：

<!-- more -->

1. 检查SHELL类型

```bash
echo $SHELL
```

如果输出不是`/bin/bash`，那么你需要更改默认shell。可以使用以下命令更改为 Bash：

```bash
chsh -s /bin/bash
```

然后重新登录。

2. 检查 `.bash_profile` 或 `.profile`

在某些情况下，如果存在 `.bash_profile` 或 `.bash_login` 文件，Bash 在登录时不会自动加载 `.bashrc`。你可以检查这些文件是否存在，并确保它们包含对 `.bashrc` 的引用。可以在 `.bash_profile` 或 `.profile` 中添加以下内容：

```bash
if [ -f "$HOME/.bashrc" ]; then
    . "$HOME/.bashrc"
fi
```

如果没有这样的文件，你也可以创建一个，然后在文件中调用`.bashrc`。

3. 检查文件权限

`.bashrc` 文件的权限应该是644。
