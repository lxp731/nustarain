---
title: 设置博客文章的圆角
date: 2023-09-09 18:06:49
categories: 博客搭建
tags:
  - 博客美化
---

同样启发与Win11，Win11最大的特点就是圆角的设计了，不得不说，真的是相比来说比较好看。

那么也把自己的博客配置为圆角的设计吧。

<!-- more -->

### 配置步骤

1. 取消注释

打开`themes\next\_config.yml`文件。   
<kbd>CTRL</kbd>+<kbd>F</kbd>查找关键字“custom_file_path”(如果你使用的是VS-CODE编辑器)。   
取消`variable: source/_data/variables.styl`注释。

```yml 折叠代码
custom_file_path:
  #head: source/_data/head.njk
  #header: source/_data/header.njk
  #sidebar: source/_data/sidebar.njk
  #postMeta: source/_data/post-meta.njk
  #postBodyEnd: source/_data/post-body-end.njk
  footer: source/_data/footer.swig
  bodyEnd: source/_data/body-end.njk
  variable: source/_data/variables.styl
  #mixin: source/_data/mixins.styl
  style: source/_data/styles.styl
```

PS：我这里取消注释的比较多，因为设置的比较多，单独说设置圆角的话，只需要取消注释`variable`即可。

2. 按照`variable`的路径添加相应的文件，如果当前不存在此文件的话。如果已经存在的话，添加以下配置。

```yml
// 圆角设置
$border-radius-inner     = 10px 10px 10px 10px;
$border-radius           = 10px;
```

值越大，圆角弧度越大，按照个人喜好设置即可。

### 补充

已经取消注释的文件对应的功能和教程链接。

|文件|功能|
|:---:|:---:|
|footer|**[背景"小飞棍"](https://nustarain.gitee.io/2023/07/17/FlyLine/)**|
|bodyEnd|**[折叠代码](https://nustarain.gitee.io/2023/09/09/blog-FoldCode/)**|
|variable|**[设置圆角](https://nustarain.gitee.io/2023/09/09/blog-fillet/)**|
|style|**[背景图片](https://nustarain.gitee.io/2023/07/17/BGPic/)**、**[博客透明度](https://nustarain.gitee.io/2023/09/09/blog-transparency/)**、**[折叠代码](https://nustarain.gitee.io/2023/09/09/blog-FoldCode/)**|