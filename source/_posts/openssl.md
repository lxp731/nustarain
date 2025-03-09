---
title: openssl 简单使用
date: 2025-03-09 15:48:29
categories: 技术
tags:
  - Linux
---

### 使用 openssl 生成公私密钥对

1. 首先生成私钥 private.pem (private.pem 密钥文件中包含了私钥和公钥) 

```bash
openssl genrsa -out private.pem 2048
```

2. 利用 private.pem 提取出公钥 public.pem

```bash
openssl rsa -in private.pem -pubout -out public.pem
```

<!-- more -->

### 使用 openssl 对文件进行签名以及验证

1. 利用私钥对文件进行签名 (signature.bin 为签名文件, file.txt 为待签名文件)

```bash
openssl dgst -sha256 -sign private.pem -out signature.bin file.txt
```

2. 利用公钥对签名进行验证

```bash
openssl dgst -sha256 -verify public.pem -signature signature.bin file.txt
```

输出 “Verified OK” 则签名、文件一致。

### 使用 openssl 对文件进行加密以及解密

#### 使用密码的方式对文件进行加密或解密

1. 使用 openssl 加密一个文件 (source.txt 为原始文件，encrypted.txt 为加密之后的文件)

```bash
openssl enc -aes-256-cbc -salt -in source.txt -out encrypted.txt
```

2. 使用 openssl 解密一个文件 (encrypted.txt 为加密之后的文件，decrypted.txt 为解密之后的文件)

```bash
openssl enc -d -aes-256-cbc -salt -in encrypted.txt -out decrypted.txt
```

#### 使用密钥对的方式对文件进行加密或解密

1. 使用 public.pem 公钥加密一个文件 (source.txt 为原始文件，encrypted.txt 为加密之后的文件)

```bash
openssl pkeyutl -encrypt -pubin -in source.txt -inkey public.pem -out encrypted.txt
```

2. 使用 private.pem 私钥解密一个文件 (encrypted.txt 为加密之后的文件，decrypted.txt 为解密之后的文件)

```bash
openssl pkeyutl -decrypt -in encrypted.txt -inkey private.pem -out decrypted.txt
```