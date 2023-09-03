---
title: Git 拒绝合并无关历史
date: 2023-03-26 22:46:29
categories: 探索
tags:
  - Git
---

### 问题描述

可能是因为经常在两台电脑上开发的缘故吧，之间来回倒腾。在windows上开发了一些东西，又回到Ubuntu后，就应该是先进行git pull。没错，就应该是这样，然而在我进行git pull时，所有的进度都进行完成之后，出现了以下的报错。

<!-- more -->

```bash
提示：您有偏离的分支，需要指定如何调和它们。您可以在执行下一次
提示：pull 操作之前执行下面一条命令来抑制本消息：
提示：
提示：  git config pull.rebase false  # 合并
提示：  git config pull.rebase true   # 变基
提示：  git config pull.ff only       # 仅快进
提示：
提示：您可以将 "git config" 替换为 "git config --global" 以便为所有仓库设置
提示：缺省的配置项。您也可以在每次执行 pull 命令时添加 --rebase、--no-rebase，
提示：或者 --ff-only 参数覆盖缺省设置。
致命错误：需要指定如何调和偏离的分支。
```

说实话我没怎么看懂这个报错，不过给了提示，我就跟着这个提示进行操作。结果：

```bash
knight@knight:~/blog/lxp731.github.io$ git config pull.rebase false
knight@knight:~/blog/lxp731.github.io$ git pull
致命错误：拒绝合并无关的历史
```

然后没办法上网查找看到这样的解决办法：

PS:记得把“main”修改为自己想pull下来的分支

### 解决办法

```bash
git pull origin main --allow-unrelated-histories 
```

PS:记得把“main”修改为自己想pull下来的分支

由此问题解决!!!