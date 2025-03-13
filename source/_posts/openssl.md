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

# 设置指定的加密模式，生成私钥时会要求输入密码。
openssl genrsa -des3 -out private.pem 2048
```

<!-- more -->

2. 利用 private.pem 提取出公钥 public.pem

```bash
openssl rsa -in private.pem -pubout -out public.pem
```

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

### Create CA Certificate

1. 假定你已经拥有了`private.pem`，即私钥文件

```bash
# 通过命令交互生成证书
openssl req -x509 -key private.pem -out ca.crt -days 365
```

```bash
# 免交互一次性生成证书
openssl req -x509 -key private.pem -out ca.crt -days 365 -subj "/C=CN/ST=Beijing/L=Beijing/O=BeiYa/OU=IT/CN=frombyte.auto/emailAddress=admin@frombyte.auto"
```

#### 参数说明：

* -x509：生成自签名证书。
* -key private.pem：指定私钥文件。
* -out ca.crt：指定输出的证书文件。
* -days 365：设置证书的有效期为 365 天。
* -subj：指定证书的主题信息，格式为 /字段=值。

#### -subj 字段说明：

* /C：国家代码（例如：CN 表示中国）。
* /ST：州或省份（例如：Beijing）。
* /L：城市或地区（例如：Beijing）。
* /O：组织名称（例如：MyCompany）。
* /OU：组织单位名称（例如：IT）。
* /CN：通用名称（通常是域名，例如：mycompany.com）。
* /emailAddress：电子邮件地址（例如：admin@mycompany.com）。

2. 查看`ca.crt`证书文件的相关信息

```bash
openssl x509 -in ca.crt -text -noout
```

### 利用私钥为自己的网站生成`csr`文件

1. 假定个人组织已经有了自己的私钥文件`frombyte.pem`

```bash
# 通过交互的方式生成 CSR 文件
openssl req -new -key frombyte.auto.pem -out frombyte.auto.csr
```

```bash
# 通过非交互的方式生成 CSR 文件
openssl req -new -key frombyte.auto.pem -out frombyte.auto.csr -subj "/C=CN/ST=Beijing/L=Beijing/O=MyCompany/OU=IT/CN=frombyte.com/emailAddress=admin@frombyte.com"
```

2. 查看 CSR 文件的内容

```bash
openssl req -text -noout -verify -in frombyte.auto.csr
```

### CA 验证 CSR 生成个人域名证书

```bash
openssl x509 -req -in frombyte.auto.csr -CA ca.crt -CAkey ca.key -set_serial 01 -out frombyte.auto.crt -days 365
```

The last, you can use frombyte.auto.pem and frombyte.auto.crt to apply your website.

### 其他参考

1. 查看并显示证书（ca.crt）的详细信息

```bash
openssl x509 -noout -text -in ca.crt
```

2. 验证客户端证书（client.pem）是否由指定的 CA 证书（ca.pem）签发

```bash
openssl verify -CAfile ca.crt client.pem
```

如果验证成功，输出 client.pem: OK。

如果验证失败，输出错误信息（如证书不匹配、证书过期等）。

3. 比较证书文件（cert.crt）和私钥文件（cert.key）中的公钥是否匹配

```bash
diff -eq <(openssl x509 -pubkey -noout -in cert.crt) <(openssl rsa -pubout -in cert.key)
```

如果公钥匹配，命令无输出（退出状态码为 0）。

如果公钥不匹配，命令无输出（退出状态码为非 0）。