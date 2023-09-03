---
title: 邮件伪造 自己给自己发了一封邮件？？？
date: 2023-04-04 21:37:00
categories: 
  - 技术
tags: 
    - 网络安全
---
网络的安全是360度向外发射的，邮件的方向也是可以被利用的漏洞。今天新学的一个技能，可以自己给自己发邮件，目前只在163邮箱进行了实验，先把今天的小成果记录下来，后续有发现再做更新。

如果有kali直接利用kali就OK，有一个工具叫swaks.

```bash
swaks --to river_li@whu.edu.cn
```

这里只指定了收件人，目的是测试发送的连通性，可以当成一个测试。

<!-- more -->

swaks 有常用的几个选项   

* --to
* --from
* --h-To
* --h-From

直接在命令行中指定的--from实际上是SMTP协议中的MailFrom字段，即信封上的From

使用--h-From指定的内容是信件内容中头部的From字段，即信件内容上，收件人看到的From

--to和--h-To同理

* --server —要登录的服务器
* --ehlo   —要验证hello的服务器
* -au    —在这个服务器上的用户名
* -ap    —对应的用户密码

swaks还可以登录登录其他的邮箱来发送邮件

```bash
swaks --server smtp.163.com --au lizic0228@163.com --ap XXXXXXXXX --ehlo smtp.163.com --from lizic0228@163.com --to river_li@whu.edu.cn
```

```bash
swaks --to m19527705687@163.com --from m19527705687@163.com --body 'This is a test mailing' --header 'Subject: test' --ehlo gmail.com --header-X-Mailer gmail.com
```

这个命令的to和from都是一样的参数，很明显是执行不成功的。

```bash
=== Trying 163mx01.mxmail.netease.com:25...
=== Connected to 163mx01.mxmail.netease.com.
<-  220 163.com Anti-spam GT for Coremail System (163com[20141201])
 -> EHLO gmail.com
<-  250-mail
<-  250-PIPELINING
<-  250-AUTH LOGIN PLAIN
<-  250-AUTH=LOGIN PLAIN
<-  250-coremail 1Uxr2xKj7kG0xkI17xGrU7I0s8FY2U3Uj8Cz28x1UUUUU7Ic2I0Y2Ur84UJgUCa0xDrUUUUj
<-  250-STARTTLS
<-  250-SIZE 73400320
<-  250 8BITMIME
 -> MAIL FROM:<m19527700560@163.com>
<** 553 Local user is not allowed,163 zwqz-mx-mta-g4-3,_____wCnFa7_NixkB9IdAA--.15197S2 1680619263
 -> QUIT
<-  221 Bye
=== Connection closed with remote host.
```

发生了553的错误。

单纯地使用命令的行的方式，总是会出现一些奇奇怪怪的错误，至今还没研究明白是怎么一回事。应该是可以使用的，等待后续更新吧。

---

更加复杂的功能可以通过指定数据实现，也是我唯一执行成功的方法。

```bash
swaks --to river_li@whu.edu.cn --data data.eml
```

指定的data内容就是一封邮件的内容，可以指定From、Subject、Content-Type、DKIM-Signature等字段。
可以把下面这一段代码，写进一个文件，命名为data.eml 在执行命令时进行引用。然后文件里的--to选项和--from选项即使相同也并不发生冲突，命令里的--to选项正常写。

```bash
Delivered-To: yixianosaurusphangnga7096@gmail.com
Received: by 2002:a4f:f31a:0:0:0:0:0 with SMTP id c26csp2268818ivo;
        Mon, 30 Mar 2020 00:33:01 -0700 (PDT)
X-Google-Smtp-Source: APiQypJvIKWdfG+6JpupjdqrYQfiXBeg7CPCrQ/ME+6eM+jUzhd19nOOsyGO1oi2FzXc892BL1EW
X-Received: by 2002:a63:6d0b:: with SMTP id i11mr2776601pgc.404.1585553581825;
        Mon, 30 Mar 2020 00:33:01 -0700 (PDT)
ARC-Seal: i=1; a=rsa-sha256; t=1585553581; cv=none;
        d=google.com; s=arc-20160816;
        b=YbBzqga5isSYWhaqAsRdWg/lzDH0S92InVplzXxAmGXkCqxdt7C3t9mOFLwZpEkpqi
         QW4Y2I4+vAIpbiMi2MqUyLL7tU2Cq/jNlaO6VX+r0Gu1nx8ZxTpUR
         b9yqaZaq6tcg48EWzGfuOT3uBs2aVp9W8Upf0MeSxPLVbpgEnzqMRjqlIhZaXAIe9kR1xg4V4IObPilZfBb4uYY0ayLTDcDDMXTc
         GyjA==
ARC-Message-Signature: i=1; a=rsa-sha256; c=relaxed/relaxed; d=google.com; s=arc-20160816;
        h=subject:from:to:date:message-id;
        bh=ecGWgWCJeWxJFeM0urOVWP+KOlqqvsQYKOpYUP8nk7I=;
        b=ZHdmyDNpyMR/DCfW1heAmecEtINi+fb5Myr8+sjj1meh6oH0VhTZzvOCTylrp/WXlu
         kGgDW2zzC95QeKAFF3ZbXClFoDVgEGECg2mTmQ2QUXB74qi5EDtu+X4izzxqjBZ+
         m97oeNIBQoka40rvItwK8foHNSo3l6k55cpTvJ6+c1SvOz/eW5f0Im7dFpX3ELrioNMK
         Kuvw==
ARC-Authentication-Results: i=1; mx.google.com;
       spf=temperror (google.com: error in processing during lookup of admin@saucer-man.com: DNS error) smtp.mailfrom=admin@saucer-man.com
Return-Path: <admin@saucer-man.com>
Received: from saucer-man.com ([003.11.50.2])
        by mx.google.com with ESMTP id m6si9771129pld.54.2020.03.30.00.33.01
        for <yixianosaurusphaaaga7096@gmail.com>;
        Mon, 30 Mar 2020 00:33:01 -0700 (PDT)
Received-SPF: temperror (google.com: error in processing during lookup of admin@saucer-man.com: DNS error) client-ip=003.11.50.2;
Authentication-Results: mx.google.com;
       spf=temperror (google.com: error in processing during lookup of admin@saucer-man.com: DNS error) smtp.mailfrom=admin@saucer-man.com
Message-ID: <5e81a0ad.1c69fb81.18eb2.4993SMTPIN_ADDED_MISSING@mx.google.com>
Date: Mon, 30 Mar 2020 15:32:58 +0800
To: yixianosaurusphaaaga7096@gmail.com
From: admin@saucer-man.com
Subject: test mail
X-Mailer: saucer-man.com

这里是信件的正文内容，可以进行修改。
```    

## PS：

***Date: Mon, 30 Mar 2020 15:32:58 +0800***

***To: yixianosaurusphaaaga7096@gmail.com***

***From: admin@saucer-man.com***

***Subject: test mail***

> Date —可以修改邮件的时间戳

> To —可以修改邮件的收件人

> From —修改邮件的发件人

> Subject —修改邮件的主题

一般修改这几项就OK了

---

### 成功的案例

```bash
swaks --to worktestnet321@163.com --data /data.eml 
```

我把文件写在了根目录下data.eml文件中，命令里的--to 是我要发送的邮件地址。

```bash
*** DEPRECATION WARNING: Inferring a filename from the argument to --data will be removed in the future.  Prefix filenames with '@' instead.
=== Trying 163mx03.mxmail.netease.com:25...
=== Connected to 163mx03.mxmail.netease.com.
<-  220 163.com Anti-spam GT for Coremail System (163com[20141201])
 -> EHLO knight
<-  250-mail
<-  250-PIPELINING
<-  250-AUTH LOGIN PLAIN
<-  250-AUTH=LOGIN PLAIN
<-  250-coremail 1Uxr2xKj7kG0xkI17xGrU7I0s8FY2U3Uj8Cz28x1UUUUU7Ic2I0Y2UFod1muUCa0xDrUUUUj
<-  250-STARTTLS
<-  250-SIZE 73400320
<-  250 8BITMIME
 -> MAIL FROM:<knight@knight>
<-  250 Mail OK
 -> RCPT TO:<m19527700560@163.com>
<-  250 Mail OK
 -> DATA
<-  354 End data with <CR><LF>.<CR><LF>
 -> Delivered-To: yixianosaurusphangnga7096@gmail.com
 -> Received: by 2002:a4f:f31a:0:0:0:0:0 with SMTP id c26csp2268818ivo;
 ->         Mon, 30 Mar 2020 00:33:01 -0700 (PDT)
 -> X-Google-Smtp-Source: APiQypJvIKWdfG+6JpupjdqrYQfiXBeg7CPCrQ/ME+6eM+jUzhd19nOOsyGO1oi2FzXc892BL1EW
 -> X-Received: by 2002:a63:6d0b:: with SMTP id i11mr2776601pgc.404.1585553581825;
 ->         Mon, 30 Mar 2020 00:33:01 -0700 (PDT)
 -> ARC-Seal: i=1; a=rsa-sha256; t=1585553581; cv=none;
 ->         d=google.com; s=arc-20160816;
 ->         b=YbBzqga5isSYWhaqAsRdWg/lzDH0S92InVplzXxAmGXkCqxdt7C3t9mOFLwZpEkpqi
 ->          QW4Y2I4+vAIpbiMi2MqUyLL7tU2Cq/jNlaO6VX+r0Gu1nx8ZxTpUR
 ->          b9yqaZaq6tcg48EWzGfuOT3uBs2aVp9W8Upf0MeSxPLVbpgEnzqMRjqlIhZaXAIe9kR1xg4V4IObPilZfBb4uYY0ayLTDcDDMXTc
 ->          GyjA==
 -> ARC-Message-Signature: i=1; a=rsa-sha256; c=relaxed/relaxed; d=google.com; s=arc-20160816;
 ->         h=subject:from:to:date:message-id;
 ->         bh=ecGWgWCJeWxJFeM0urOVWP+KOlqqvsQYKOpYUP8nk7I=;
 ->         b=ZHdmyDNpyMR/DCfW1heAmecEtINi+fb5Myr8+sjj1meh6oH0VhTZzvOCTylrp/WXlu
 ->          kGgDW2zzC95QeKAFF3ZbXClFoDVgEGECg2mTmQ2QUXB74qi5EDtu+X4izzxqjBZ+
 ->          m97oeNIBQoka40rvItwK8foHNSo3l6k55cpTvJ6+c1SvOz/eW5f0Im7dFpX3ELrioNMK
 ->          Kuvw==
 -> ARC-Authentication-Results: i=1; mx.google.com;
 ->        spf=temperror (google.com: error in processing during lookup of admin@saucer-man.com: DNS error) smtp.mailfrom=admin@saucer-man.com
 -> Return-Path: <admin@saucer-man.com>
 -> Received: from saucer-man.com ([003.11.50.2])
 ->         by mx.google.com with ESMTP id m6si9771129pld.54.2020.03.30.00.33.01
 ->         for <yixianosaurusphaaaga7096@gmail.com>;
 ->         Mon, 30 Mar 2020 00:33:01 -0700 (PDT)
 -> Received-SPF: temperror (google.com: error in processing during lookup of admin@saucer-man.com: DNS error) client-ip=003.11.50.2;
 -> Authentication-Results: mx.google.com;
 ->        spf=temperror (google.com: error in processing during lookup of admin@saucer-man.com: DNS error) smtp.mailfrom=admin@saucer-man.com
 -> Message-ID: <5e81a0ad.1c69fb81.18eb2.4993SMTPIN_ADDED_MISSING@mx.google.com>
 -> Date: Mon, 30 Mar 2020 15:32:58 +0800
 -> To: worktestnet321@163.com
 -> From: worktestnet321@163.com
 -> Subject: test mail
 -> X-Mailer: saucer-man.com
 -> 
 -> 4008208820 DNC 橡果国际 新购物 新生活
 -> 
 -> .
<-  250 Mail OK queued as zwqz-mx-mta-g9-1,_____wBHQvQpOyxkxthYAA--.22943S2 1680620329
 -> QUIT
<-  221 Bye
=== Connection closed with remote host.
```

出现250的状态码发送成功，