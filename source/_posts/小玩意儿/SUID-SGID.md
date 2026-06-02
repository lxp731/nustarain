---
title: 检测带有 SUID SGID 的文件
date: 2023-10-01 12:59:49
categories: 小玩意儿
tags:
  - Linux
---

### 背景

在linux中，关于 SUID 和 SGID 这种特殊权限的使用，是非常谨慎的，稍有不慎，便有可能导致权限泄露。所以在工作中，常常需要对系统进行检测，重点关注除了 Linux 系统以外的带有类似 SUID 和 SGID 这种特殊权限的文件。下面是检测带有 SUID 和 SGID 特殊权限位的脚本，方便各位使用。

<!-- more -->

```bash 点击折叠
#!/bin/bash

# 检查是否提供了目录作为参数
if [ $# -ne 1 ]; then
    echo "用法: $0 <目录路径>"
    exit 1
fi

# 获取要扫描的目录路径
scan_directory="$1"

# 检查目录是否存在
if [ ! -d "$scan_directory" ]; then
    echo "目录不存在: $scan_directory"
    exit 1
fi

# 创建一个存储结果的文件
output_file="suid_sgid_files.txt"
touch "$output_file"

# 搜索并记录SUID和SGID文件
echo "$(date "+%F %H:%M")" >> "$output_file"
echo "以下是带有SUID和SGID权限的文件和目录：" >> "$output_file"
find "$scan_directory" -type f \( -perm -4000 -o -perm -2000 \) -exec ls -l {} \; >> "$output_file" 2>/dev/null
find "$scan_directory" -type d \( -perm -4000 -o -perm -2000 \) -exec ls -ld {} \; >> "$output_file" 2>/dev/null

echo "结果已保存到 $output_file"
```