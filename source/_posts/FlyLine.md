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

```yml
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