---
title: Git克隆指定的分支
date: 2023-08-06 21:23:09
categories: 学习过程
tags:
  - Git
---

### 问题描述

在Git克隆时，有时候我们不一定要克隆主分支，更多的也会遇到克隆其他分支，而在默认的克隆中，会直接克隆主分支，那么如何克隆其他分支呢？

### 解决办法

执行下面的命令

```git
git clone --branch <branchname> <remote-repo-url>
```

<!-- more -->

或者

```git
git clone -b <branchname> <remote-repo-url>
```

这里 -b 只是 --branch 的别名。

这样，你就可以获取仓库中的所有分支，切换到你指定的分支，指定的分支成为本地分支用于 git push 和 git pull。但你仍然从每个分支中获取了所有文件。虽然已经达到了想要的结果，但是这样的效果并不是很令人满意。

这会自动将指定的分支配置为本地分支，但仍会跟踪其他分支。类似这样：

```bash
knight@knight:~/nustarain$ git remote show origin 
* 远程 origin
  获取地址：https://gitee.com/nustarain/nustarain.git
  推送地址：https://gitee.com/nustarain/nustarain.git
  HEAD 分支：main
  远程分支：
    hexo 已跟踪
    main 已跟踪
  为 'git pull' 配置的本地分支：
    hexo 与远程 hexo 合并
    main 与远程 main 合并
  为 'git push' 配置的本地引用：
    hexo 推送至 hexo (最新)
    main 推送至 main (最新)
```

如果要单纯的只克隆一个分支，只需要加一个参数即可：

```git
git clone --branch <branchname> --single-branch <remote-repo-url>
```

或者

```git
git clone -b <branchname> --single-branch <remote-repo-url>
```

加上--single-branch就只会跟踪这个指定的分支了。