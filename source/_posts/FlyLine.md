---
title: 设置博客背景动态特效
date: 2023-07-17 21:51:11
categories: 博客搭建
tags:
  - 博客美化
---

### 修改配置文件

静态的博客实在是太单调了，增加一点动态的效果吧。

1. 同添加背景图片一样，同样需要打开一个开关，也就是取消footer这个注释。

<!-- more -->

```yml 折叠代码
custom_file_path:
  #head: source/_data/head.njk
  #header: source/_data/header.njk
  #sidebar: source/_data/sidebar.njk
  #postMeta: source/_data/post-meta.njk
  #postBodyEnd: source/_data/post-body-end.njk
  footer: source/_data/footer.swig
  #bodyEnd: source/_data/body-end.njk
  #variable: source/_data/variables.styl
  #mixin: source/_data/mixins.styl
  style: source/_data/styles.styl
  ```

2. 取消注释以后，创建这样的一个文件source/_data/footer.swig，需要注意的是，这个source是站点目录下的source，而不是主题目录下的source。

创建好之后，在文件插入以下代码：

```js
<script color="107,194,53" opacity="1.0" zIndex="-1" count="99" src="https://cdn.jsdelivr.net/npm/canvas-nest.js@1/dist/canvas-nest.js"></script>
```

* color设置的是线条的RGB值。
* opacity设置的是类似透明度的数值。
* count设置的是线条的数量。

重新生成一下配置，就会出现效果了。

### 补充

已经取消注释的文件对应的功能和教程链接。

|文件|功能|
|:---:|:---:|
|footer|**[背景"小飞棍"](https://nustarain.gitee.io/2023/07/17/FlyLine/)**|
|bodyEnd|**[折叠代码](https://nustarain.gitee.io/2023/09/09/blog-FoldCode/)**|
|variable|**[设置圆角](https://nustarain.gitee.io/2023/09/09/blog-fillet/)**|
|style|**[背景图片](https://nustarain.gitee.io/2023/07/17/BGPic/)**、**[博客透明度](https://nustarain.gitee.io/2023/09/09/blog-transparency/)**、**[折叠代码](https://nustarain.gitee.io/2023/09/09/blog-FoldCode/)**|