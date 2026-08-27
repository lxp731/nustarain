---
title: ChatGPT 共享站项目复盘：基于 new-api 的 AI 网关运维实践
date: 2026-08-27 10:20:00
categories: 技术
password: buzhidao
tags:
  - LLM
  - K8S
  - 项目复盘
  - 面试
  - 私密

---

我做了一个基于 new-api 的 AI 对话共享站：对外提供"聊天界面 + OpenAI 兼容 API"的统一 AI 服务。

<!--more-->

> 适用岗位：运维工程师 / 技术支持工程师 / AI 运维工程师 / DevOps 工程师（AI运维岗必考）

---

## 一、项目速览

我做了一个基于 **new-api** 的 AI 对话共享站：对外提供"聊天界面 + OpenAI 兼容 API"的统一 AI 服务。

- **定位**：new-api 是开源项目（GitHub: Calcium-Ion/new-api），本质是 OpenAI 接口的**聚合/中继网关**——上游接多家模型渠道（deepseek、OpenAI、本地 vLLM 等），下游对外只暴露一个 OpenAI 风格接口，并提供**令牌管理、额度计费、限流**能力。
- **我的工作**：先是 docker-compose 版本（new-api + Redis + MySQL 8.2），后来**完整重构到 Kubernetes**（namespace + Redis + PostgreSQL + Ingress，文档记录了全过程），并把对外入口做成 `https://api.internal/v1`（OpenAI SDK 直接可调）。
- **技术栈**：Kubernetes、Docker、nginx Ingress、cert-manager（私有 CA）、PostgreSQL、Redis、Harbor 私有镜像仓库。
- **结果**：服务长期稳定运营，团队和用户用"一个 base_url + 一个 key"就能调用多模型，我负责从部署、K8s 化、证书到运维文档的全链路。

---

## 二、项目背景

> 动机：给团队/用户提供统一的 AI 对话与 API 服务；网关选型

**1. 动机（为什么做）**

- 团队和个人站点都需要 AI 对话能力，但直接各家用各家的：官网网页版散乱、不好管理；直接对接各家 API 需要自己解决密钥分发、额度控制、多模型切换，成本高又容易失控。
- 想要一个"统一出口"：对外只暴露一个 OpenAI 兼容接口，对内能接多家模型渠道，且能管人（令牌）、管钱（额度）、管量（限流）。
- 个人站点（sharedchat.fun 标注"基于 GPT-4.0 的公共服务、长期运营"）是这套能力对外的呈现，技术底座就是 new-api 网关。
- 团队环境里`` 里已有 qdrant、open-webui、vllm 等同类容器编排，说明"开源组件 + 私有化部署 + 容器化"是团队统一的基础设施模式，本项目是其中一环。

**2. 网关选型（为什么是 new-api）**

- 对比过 one-api / new-api / 自研轻量代理。自研要自己解决令牌、计费、限流、多渠道管理，工作量远大于收益；one-api 停更风险高、渠道支持少。
- new-api 是 one-api 的分支并持续迭代：**渠道管理**（接 deepseek/OpenAI/本地 vLLM 都行）、**令牌系统**（每人一个 key，带额度）、**模型倍率计费**、**限流**、**日志审计**，全部开箱即用；社区活跃，踩坑有现成方案。
- 官方 docker-compose 开箱即跑（new-api + Redis + MySQL 8.2，自带 `/api/status` healthcheck），上手成本低。

**3. 为什么上 K8s（重构动机）**

- docker-compose 是单机形态，服务发现靠容器名、存储靠本地卷，无法支撑集群化、探针、证书管理和后续扩展。
- 公司已有 RKE2/k3s 集群和 Harbor 私有仓库、cert-manager 证书体系，把 new-api 迁进来才能纳入统一的发布、证书、存储规范。

---

## 三、完成情况

> 技术架构：new-api 网关 + Redis + PostgreSQL + Ingress，K8s 化部署，HTTPS/私有 CA，调用链路

**1. 架构总览（面试可以现场画）**

```
用户浏览器 / OpenAI SDK（api.internal，HTTPS，私有 CA 证书）
        │
        ▼
nginx Ingress（cert-manager 签发 TLS：api-tls-secret）
        │
        ▼
new-api Service（ClusterIP :3000，namespace: new-api）
        │
        ▼
new-api Deployment（initContainers 检查依赖 → 主容器）
        │                │
        ▼                ▼
   Redis Service     PostgreSQL Service（PVC 5Gi 持久化）
   （缓存/计数）       （渠道、令牌、额度、账务）
        │
        ▼
上游模型渠道：deepseek-chat / OpenAI / 本地 vLLM（统一 OpenAI 兼容接口）
```

**2. 第一版：docker-compose（原始素材）**

- `new-api`：`calciumion/new-api:latest`，`SQL_DSN=root:123456@tcp(mysql:3306)/new-api`、`REDIS_CONN_STRING=redis://redis`、`TZ=Asia/Shanghai`；healthcheck 用 `wget` 请求 `http://localhost:3000/api/status` 检查 `"success":true`。
- 配套 `redis` + `mysql:8.2`（带数据卷 `mysql_data`）。

**3. 第二版：K8s 化重构（`k8s-services/new-api/`，文档 `docs/250311_new_api.md` 完整记录）**

- **namespace**：`create-namespace.yaml`（`new-api`）。
- **Redis**：Deployment + Service（6379），镜像走私有 Harbor（`harbor.internal/library/redis:latest`），带资源 requests/limits。
- **PostgreSQL 替换 MySQL**：PVC（5Gi，ReadWriteOnce）+ Deployment（`POSTGRES_USER=root`、`POSTGRES_DB=new-api`）+ Service（5432）；`postgres-cleaner` 一次性清理 Pod 解决首次初始化失败（详见 Q6）。
- **new-api**：Deployment 用 **initContainers**（busybox `nc -z postgres 5432` / `nc -z redis 6379` 循环等待依赖就绪），env 改为 `SQL_DSN=postgres://root:***@postgres:5432/new-api?sslmode=disable`、`REDIS_CONN_STRING=redis://redis`、`TZ=Asia/Shanghai`、`LOG_DIR=/app/logs`；**livenessProbe** httpGet `/api/status`（initialDelaySeconds 30 / periodSeconds 30 / failureThreshold 3）；Service 为 ClusterIP:3000。
- **Ingress**：`networking.k8s.io/v1`，`ingressClassName: nginx`，host `api.internal`，path `/` Prefix → Service 3000，TLS 引用 cert-manager 签发的 secret。

**4. HTTPS / 私有 CA（证书管理）**

- cert-manager 的 **CA 型 ClusterIssuer**（`cluster-issuer`，基于内部 CA 的 `rancher-ca` secret）→ `Certificate` 资源（`api-cert`，`dnsNames: api.internal`）→ 自动写入 `api-tls-secret` → Ingress TLS 引用。
- 代价：证书是**私有 CA 签发**，客户端必须信任 `ca.crt` 才能无告警访问（浏览器导入 CA；Python/OpenAI SDK 调用要传 `verify=ca.crt`）。

**5. 调用链路与放号流程（对外可交付）**

- OpenAI SDK 调用示例（运维文档）：`base_url="https://api.internal/v1"`，`model="deepseek-chat"`，`http_client=httpx.Client(verify=ca.crt路径)`。
- 申请 key 流程：加 hosts 记录 → 浏览器打开 `api.internal` 登录 → 申请/查看自己的 key → 按文档调用。
- 文档体系：部署实录、调用方法、申请 key 与浏览器信任私有 CA 的步骤等，沉淀成完整运维文档。

---

## 四、负责内容

> 独立或主导：部署、K8s 化、证书、文档

本项目由我**独立完成**，主要分四块：

1. **初版部署**：按官方 docker-compose 落地 new-api + Redis + MySQL 8.2，验证 `/api/status` 健康检查与基本对话链路，跑通放号（申请 key → 调用）全流程。
2. **K8s 化重构（主导）**：把 compose 三个服务拆成 namespace 下的 Deployment + Service；**PostgreSQL 替换 MySQL**（改连接串、加 PVC 持久化、写 postgres-cleaner 排障）；new-api 加 initContainers 依赖检查与 livenessProbe；镜像全部切到公司私有 Harbor。
3. **证书与入口**：对接 cert-manager + 私有 CA ClusterIssuer，为 `api.internal` 签发证书，配置 Ingress 的 TLS 与路由规则；解决客户端信任问题（写导入 ca.crt 的教程）。
4. **运维文档沉淀**：撰写/维护完整的部署、调用、申请与排障文档，让后来者按文档即可自助开通。

---

## 五、完成成效

> 长期稳定运营、统一 API 出口；客观说明规模

1. **长期稳定运营**：服务自上线后长期在线（个人站点 sharedchat.fun 持续对外提供服务），遇到故障有完整的"发现 → 定位 → 修复 → 沉淀文档"闭环（详见 Q13）。
2. **统一 API 出口**：团队和用户只需记住"一个域名 `api.internal/v1` + 一个 key"，就能调用网关背后的多模型渠道，省去各家对接成本；聊天界面（open-webui 一类）也可直接接这个 OpenAI 兼容端点。
3. **工程规范落地**：完成 docker-compose → K8s 的迁移样板，纳入了公司统一的 Harbor 镜像、cert-manager 证书、PVC 存储、文档规范，后续同类服务可复制这套模式。
4. **客观说明规模（诚实边界，别吹）**：这是**个人/小团队量级**的服务，**单副本**部署（new-api、Redis、PostgreSQL 各 1 个 Pod），高可用冗余有限——面试时主动讲清楚这个边界反而加分：说明你知道"单副本 ≠ 生产级高可用"，并给出多副本/数据库高可用的演进方案（见 Q15）。

---

## 六、面试官提问与参考回答

**题量分布**：基础问题 4 题 + 深入问题 6 题 + 刁钻/压力问题 5 题 = 15 题。

| 分组 | 题号 | 问题一句话 |
|---|---|---|
| 基础 | Q1 | new-api 是什么？这个项目做什么？ |
| 基础 | Q2 | 整体架构怎么画？数据流怎么走？ |
| 基础 | Q3 | 为什么用 new-api 而不是自研代理？ |
| 基础 | Q4 | 数据怎么存？MySQL 换 PostgreSQL 怎么做的？ |
| 深入 | Q5 | docker-compose 迁到 K8s 的思路与步骤？ |
| 深入 | Q6 | postgres-cleaner 是什么？解决什么问题？ |
| 深入 | Q7 | Redis 在 new-api 里起什么作用？ |
| 深入 | Q8 | 健康检查从 docker 到 K8s 怎么改的？ |
| 深入 | Q9 | HTTPS/私有 CA 怎么做？为什么不用 Let's Encrypt？ |
| 深入 | Q10 | 令牌、额度、限流怎么管理？ |
| 压力 | Q11 | 简历写"GPT-4.0"但调用是 deepseek-chat，底层到底是什么模型？ |
| 压力 | Q12 | "无限制的 AI 对话体验"——没有成本控制吗？被薅羊毛怎么办？ |
| 压力 | Q13 | 长期运营稳定吗？遇到过什么故障、怎么恢复的？ |
| 压力 | Q14 | 公共服务对外暴露，密钥泄露、内容合规怎么防？ |
| 压力 | Q15 | 流量涨 10 倍，你的架构怎么扛？ |

---

### 第一组：基础问题（4 题）

#### Q1. 介绍一下这个项目？new-api 是什么？

- 【面试官意图】考察你能否用 1 分钟讲清项目定位，以及是否真的理解 new-api 是什么（很多简历写了"网关"但说不清）。
- 【参考回答】结论一句话：这是一个基于 new-api 网关的 AI 服务共享站，对外提供 OpenAI 兼容的对话 API。new-api 是 GitHub 上的开源项目 Calcium-Ion/new-api，本质是 OpenAI 接口的聚合/中继网关：上游可以接多家模型渠道，比如 deepseek、OpenAI、本地 vLLM，下游对外只暴露一个统一的 OpenAI 风格接口，同时内置令牌管理、额度计费、限流这些能力。我的角色是把这套东西从 docker-compose 重构到 Kubernetes，并把 HTTPS、放号流程、运维文档整个链路补齐，最后对外就是 `https://api.internal/v1` 这个入口。
- 【追问】
  - 追问 1：new-api 和 one-api 是什么关系？→ new-api 是从 one-api fork 出来的分支，渠道支持更多、社区更新更活跃，很多国内团队在用；它兼容 one-api 的用法，所以迁移成本低。
  - 追问 2：它对外暴露的接口长什么样？→ 就是 OpenAI SDK 兼容：`base_url` 设成 `https://api.internal/v1`，`model` 传 `deepseek-chat`，OpenAI 官方 Python/JS SDK 直接能调，不用改业务代码。
- 【岗位侧重】通用

#### Q2. 整体架构是什么样？帮我画一下，数据流怎么走？

- 【面试官意图】考察架构表达能力和对数据面的理解，是否只停留在"我部署过"。
- 【参考回答】结论：客户端 → Ingress → new-api → 上游渠道，Redis 和 PostgreSQL 做支撑。用户请求打到 `api.internal`，nginx Ingress 终止 TLS 后转发到 new-api 的 ClusterIP Service（3000 端口）；new-api 先查 Redis 做令牌校验和限流计数，再从 PostgreSQL 读渠道、令牌、额度配置，最后把请求转发到上游模型渠道并把流式响应原路回传。数据面上，PostgreSQL 管配置和账务，Redis 管缓存和高频计数。
- 【追问】
  - 追问 1：为什么中间非要一个 Redis？→ new-api 通过 `REDIS_CONN_STRING` 连接，令牌校验、额度/用量计数、限流这些高频读写放 Redis，避免每次请求都打数据库；不配也能跑（退化成直查库/内存），但性能和多实例共享状态都不行。
  - 追问 2：Ingress 挂了会怎样？→ Ingress 本身是集群级组件，我们用的是多副本高可用的 nginx ingress-controller，单个 Pod 挂掉会自动重启；真正的入口风险在证书和域名解析，而不是 Ingress 本身。
- 【岗位侧重】通用 / 运维

#### Q3. 为什么用 new-api，而不是自己写一个代理？

- 【面试官意图】考察选型思路和对比能力，看你是不是"拿来就用、没想过为什么"。
- 【参考回答】结论：自研代理要自己解决令牌、计费、限流、多渠道管理，工作量远大于收益，而 new-api 这些全开箱即用。它提供渠道管理（deepseek、OpenAI、本地 vLLM 都能接）、令牌系统（每人一个 key 带独立额度）、模型倍率计费、限流和日志审计，社区活跃、文档全，踩坑有现成方案。另外我们公司仓库里 qdrant、open-webui、vllm 也都是"开源组件 + 私有化容器部署"的模式，选 new-api 和团队的基础设施风格是一致的。
- 【追问】
  - 追问 1：open-webui 和 new-api 是什么关系？→ open-webui 是聊天前端，它可以配置 OpenAI 兼容端点作为后端；我这边 open-webui 的 docker-compose 也在仓库里，两者组合就是"聊天界面 + API 网关"，这也是共享站"既能网页聊、又能 API 调"的原因。
  - 追问 2：选型时还对比过什么？→ 主要对比 one-api 和 new-api，还考虑过自研轻量代理；因为需要计费和令牌管理，自研性价比低，最终选 new-api。
- 【岗位侧重】通用 / DevOps

#### Q4. 数据怎么存的？MySQL 换 PostgreSQL 是怎么做到的？

- 【面试官意图】考察是否真部署过、以及数据库层替换的细节（很多人只会"换镜像"）。
- 【参考回答】结论：数据存在 PostgreSQL，替换 MySQL 只改了连接串，应用层零改动。原始 docker-compose 里 new-api 的 `SQL_DSN` 指向 `mysql:3306`；K8s 化时我改用 PostgreSQL，连接串变成 `postgres://root:xxx@postgres:5432/new-api?sslmode=disable`，通过 Deployment 的环境变量注入，因为 new-api 兼容 MySQL 和 PostgreSQL 两种方言，所以应用代码不用动。PG 是 Deployment + 5Gi 的 PVC 持久化，数据不随 Pod 重启丢失。
- 【追问】
  - 追问 1：为什么换成 PostgreSQL？→ 团队数据库栈以 PG 为主（仓库 `docker_archive/container/postgres/` 就是现成的编排模板），统一技术栈便于维护；new-api 官方支持 PG，替换成本低。
  - 追问 2：MySQL 里的存量数据迁移了吗？→ 当时是全新部署，没有存量迁移；如果真有，我会用 new-api 的备份/导出接口先把数据倒出来，再导入 PG，并做一轮全链路验证。
- 【岗位侧重】通用 / 运维

---

### 第二组：深入问题（6 题）

#### Q5. docker-compose 迁到 K8s 的具体思路和步骤是什么？

- 【面试官意图】这是本项目最核心的考点，考察 K8s 基本功和迁移方法论。
- 【参考回答】结论：思路是"服务拆分 + 配置外置 + 依赖就绪 + 存储持久化 + 入口接管"五步。① 把 compose 里的 new-api、redis、mysql 三个服务拆成各自独立的 Deployment + Service，放进 `new-api` namespace；② 环境变量（`SQL_DSN`、`REDIS_CONN_STRING`、`TZ`）从 compose 的 environment 搬进 Deployment env，并且用 K8s Service 名做服务发现，比如数据库就叫 `postgres`、缓存就叫 `redis`；③ 用 initContainers 做依赖检查，busybox 循环 `nc -z postgres 5432`，直到依赖就绪才启动主容器，避免启动即报"连不上库"；④ 有状态的部分挂 PVC，docker 的 healthcheck 翻译成 livenessProbe；⑤ 对外入口从端口映射改成 Ingress，TLS 交给 cert-manager。
- 【追问】
  - 追问 1：hostPath 和 PVC 怎么取舍？→ 生产数据用 PVC（我们的 PG 数据就是 5Gi PVC，跨 Pod 调度不丢）；当时 new-api 的日志目录用了 hostPath，单节点没问题，要上多副本就得换成 PVC 或共享存储。
  - 追问 2：镜像从哪拉？→ 全部从公司私有 Harbor（`harbor.internal`）拉取，走内网化/离线化，符合公司镜像统一管理规范；这也避免了直接依赖 Docker Hub 的网络问题。
- 【岗位侧重】DevOps / 运维

#### Q6. postgres-cleaner 是什么？解决什么问题？

- 【面试官意图】考察踩坑与排障能力——这是部署实录里最真实的细节，能说出来说明你真做过。
- 【参考回答】结论：它是解决"PostgreSQL 首次初始化失败"的一次性清理 Pod。原因：PG 官方镜像要求数据目录为空才能初始化，但第一次部署时 PVC 挂载的数据目录里已经有残留内容（比如之前部署失败留下的数据、挂载点元数据），PG 初始化直接报错。cleaner 是一个 busybox 一次性 Pod，挂载同一个 PVC，执行 `rm -rf /data/*` 清空目录，`restartPolicy: Never` 跑完即止；清完后再正常启动 postgres 就成功了。
- 【追问】
  - 追问 1：为什么不直接在 postgres 启动命令里清？→ 正常流程不该有残留，把清理做成独立的一次性 Pod，是为了保持"故障 → 诊断 → 修复"的过程可见、可审计，而且只清这个 PVC 的挂载目录，避免误删别的东西。
  - 追问 2：现在集群里还有这个 Pod 吗？→ 没有，跑完就删了，它是排障专用；正常路径是 PVC 干净 → 直接部署 postgres。
- 【岗位侧重】运维 / AI运维

#### Q7. Redis 在 new-api 里到底起什么作用？

- 【面试官意图】考察对中间件角色的理解，而不是"我照文档配了"。
- 【参考回答】结论：Redis 主要做缓存和计数：令牌校验结果、额度/用量计数、限流计数、会话这类高频数据。new-api 通过 `REDIS_CONN_STRING` 连接 Redis；不配也能跑（退化为直查数据库或内存态），但配上能显著减轻数据库压力，而且多实例部署时必须靠 Redis 共享状态。我把 Redis 也搬进了 K8s（Deployment + Service，6379 端口），镜像走私有 Harbor。
- 【追问】
  - 追问 1：Redis 挂了会怎样？→ new-api 有容错，会退回数据库直查，功能不中断但性能下降、限流可能失效；我们当时 Redis 是单副本，这是个人/小团队量级可接受的边界，真挂了重启即可。
  - 追问 2：new-api 多副本部署时必须配 Redis 吗？→ 必须。多实例要共享令牌/额度状态就靠 Redis；对应 new-api 多机部署的配置还有 `SESSION_SECRET`（多机必须改）、`NODE_TYPE=slave`、`SYNC_FREQUENCY`、`FRONTEND_BASE_URL`，这些在官方 compose 注释里都写着。
- 【岗位侧重】运维 / AI运维

#### Q8. 健康检查怎么从 docker 搬到 K8s 的？

- 【面试官意图】考察探针知识（liveness/readiness 区别、参数含义），运维岗常考。
- 【追问】
  - 追问 1：为什么用 `/api/status` 这个端点？→ 它是 new-api 内置的状态接口，返回 `{"success":true}` 这类 JSON，能真实反映应用可用，而不是只验证端口通不通。
  - 追问 2：liveness 和 readiness 有什么区别？→ liveness 决定"要不要重启"，readiness 决定"能不能接流量"；网关类服务主要用 liveness 就够了，有启动耗时、依赖迁移的应用才需要 readiness 控制流量什么时候放进来。
- 【岗位侧重】运维 / DevOps

#### Q9. HTTPS 和私有 CA 是怎么做的？为什么不用 Let's Encrypt？

- 【面试官意图】考察证书体系理解（cert-manager、ClusterIssuer、私有 CA 的取舍），这是本项目最容易暴露"只配置不理解"的点。
- 【参考回答】结论：用 cert-manager + CA 型 ClusterIssuer 给 `api.internal` 自动签发证书；不用 Let's Encrypt 是因为这是私有域名 + 内网环境，没有公网 ACME 验证通道。具体做法：集群里先有 cert-manager 和一个 CA 型 `cluster-issuer`（基于内部根 CA 的 `rancher-ca` secret），再创建 `Certificate` 资源（`api-cert`，`dnsNames: api.internal`），cert-manager 自动把签好的证书写进 `api-tls-secret`，Ingress 的 TLS 段引用这个 secret 即可。代价是客户端必须信任我们内部 CA——所以文档里专门写了浏览器导入 `ca.crt` 的步骤，Python/OpenAI SDK 调用要传 `verify=ca.crt` 路径。
- 【追问】
  - 追问 1：证书到期怎么办？→ cert-manager 自动续期，到期前自动重签并更新 secret，ingress-nginx 会自动加载新证书，运维无感；这是当初选 cert-manager 而不是手工签证书的主要原因。
  - 追问 2：为什么客户端要装 ca.crt？→ 因为根 CA 是我们自签的内部 CA，不在系统和浏览器的信任库里；客户端信任这个 CA 后，所有内部域名签发的证书都被信任，相当于内网 PKI 的根。
- 【岗位侧重】运维 / DevOps

#### Q10. 令牌、额度、限流是怎么管理的？

- 【面试官意图】考察 new-api 核心功能的理解和成本控制思维——AI 运维岗必考。
- 【参考回答】结论：new-api 的令牌系统就是答案：在管理后台给每个用户/应用创建一个 Token（key），并配置额度（quota）、可用模型、模型倍率、有效期、限流（比如每分钟请求数），用量按模型倍率实时扣减。对外放号就是"申请 key → 设额度 → 用户用 OpenAI SDK 调"。这正好回答"怎么防滥用"：额度用完 key 自动失效，超限流直接 429，管理员随时可以吊销某个 key。
- 【追问】
  - 追问 1：额度是什么单位？怎么扣的？→ new-api 里有额度（quota）概念，每个模型配一个倍率，请求时按模型倍率从令牌额度里扣减，贵模型倍率高、扣得快，天然引导用户用便宜模型。
  - 追问 2：有人拿 key 去调他没权限的模型怎么办？→ 令牌可以限定可用的渠道/模型范围；后台还有每个 key 的调用明细日志，异常行为一眼可见，直接吊销重发。
- 【岗位侧重】AI运维

---

### 第三组：刁钻/压力问题（5 题）

#### Q11. 简历写"基于 GPT-4.0 的公共服务"，但调用示例是 deepseek-chat，底层到底是什么模型？

- 【面试官意图】压力测试 + 诚信测试：看你会不会为了圆谎越编越大，或直接露怯。这是本项目常见的高难度问题。
- 【追问】
  - 追问 1：你能保证用户每次请求用的就是 GPT-4.0 吗？→ 不能拍胸脯保证每个请求都落到 GPT-4.0，路由由网关按渠道配置和可用性决定；如果我对外承诺"100% GPT-4.0"而实际路由到别的模型，那是不严谨的。
- 【岗位侧重】通用（所有岗位重点）

#### Q12. 你说"无限制的 AI 对话体验"，没有成本控制吗？被薅羊毛怎么办？

- 【面试官意图】考察成本意识与限流设计——"无限制"三个字是简历里的高危表述，面试官一定会抓。
- 【追问】
  - 追问 1：如果真有人刷爆你的额度怎么办？→ 单个 key 额度独立封顶，刷爆的是他那个 key，不影响别人；网关层还有全局限流和告警，可以在总预算被打穿前人工介入、吊销 key。
  - 追问 2：实际遇到过滥用吗？→ 遇到过有人拿 key 到处乱发的情况，处理是吊销 key、收紧新 key 的默认额度、在申请文档里写明使用规范，之后基本没有再犯。
- 【岗位侧重】AI运维

#### Q13. 你说长期运营，稳定吗？遇到过什么故障、怎么恢复的？

- 【面试官意图】考察故障处理能力和诚实度——编一个"零故障"的故事比讲真故障更危险。
- 【参考回答】结论：服务整体长期在线，但确实踩过坑，印象最深三个：① PostgreSQL 首次初始化失败（数据目录非空），用 postgres-cleaner 一次性清理后恢复正常，并把原因和修法写进了部署文档；② new-api Pod 偶发重启，靠 livenessProbe 自动拉起，用户基本无感知；③ 证书信任问题——用户第一次访问总报不安全，排查发现是浏览器没导入内部 ca.crt，后来把导入步骤写进申请文档，问题就消失了。这三次都是"发现 → 定位 → 修复 → 沉淀文档"的完整闭环。
- 【追问】
  - 追问 1：Pod 重启算不算故障？→ 单副本下重启会有秒级抖动，对个人/小团队服务可接受；真正做 SLA 的场合要上多副本 + readiness 探针 + 数据库高可用，我在 Q15 里讲了演进路径。
  - 追问 2：有没有丢过数据？→ 没有。PG 数据在 PVC 上持久化，Pod 重启不丢数据；这也验证了当时坚持挂 PVC 而不是裸跑容器是对的。
- 【岗位侧重】运维 / AI运维

#### Q14. 公共服务暴露在外网，密钥泄露、内容合规怎么防？

- 【面试官意图】考察安全合规意识——运维和技术支持岗都爱问，答得不好会显得没有生产安全意识。
- 【参考回答】结论：核心是"最小化暴露 + 可追溯 + 可熔断"。最小化：key 按人/按应用独立发放、额度独立，泄露一个只影响一个；可追溯：每个请求都能查到是哪个 key、哪个 IP、调了什么模型；可熔断：发现异常随时吊销 key、封禁 IP。内容合规方面：网关自身不做内容审核时，靠平台使用规则 + 渠道侧策略约束，日志按规范保留、最小化收集用户输入，敏感内容不额外留存。
- 【追问】
  - 追问 1：key 泄露了怎么处理？→ 立刻吊销并重新签发，查泄露 key 的调用记录评估影响，再收紧该用户的额度默认值，最后把泄露原因记入文档避免再犯。
  - 追问 2：用户对话内容会被记录下来吗？→ 网关会保留调用日志（排障和审计需要），但按"最小必要"原则，明文对话内容不做额外留存，日志和后台的访问都做权限控制。
- 【岗位侧重】通用 / 运维 / 技术支持

#### Q15. 如果流量涨 10 倍，你的架构怎么扛？

- 【面试官意图】考察扩展性思考和诚实边界——看你是吹"天生高可用"还是能讲清演进路径。
- 【参考回答】结论：当前是单副本的个人/小团队量级，涨 10 倍我会按三步走：① new-api 扩多副本，配置 `SESSION_SECRET`、`NODE_TYPE=slave`、`SYNC_FREQUENCY`、`FRONTEND_BASE_URL` 做多机部署，前面由 Ingress 自带负载均衡分发；② Redis 承担更多缓存和计数，保证多实例间令牌/额度状态一致；③ 数据库是单点，PG 从单实例升级为主从或直接复用公司现成的 PG 高可用方案。再往上就是补监控告警、分层限流和容量规划。
- 【追问】
  - 追问 1：数据库会是瓶颈吗？→ 网关这种读写比，PG 单实例能扛的量级其实不低，但多副本后连接数和写放大要关注，所以第二步就把 PG 高可用提上日程，而不是等爆了再动。
  - 追问 2：现在有什么监控？→ 当时主要通过 K8s 探针、Pod 状态和 new-api 自带日志/后台统计看健康度；生产级会补 Prometheus + Grafana 和告警，这是我后续迭代的方向，也正好是我想在岗位上补足的能力。
- 【岗位侧重】DevOps / AI运维

---

## 附：一句话总结

> 我用 new-api 网关搭了一个统一 AI 服务出口：docker-compose 起步，后来完整重构到 K8s（Redis 做缓存计数、PostgreSQL 持久化、Ingress + cert-manager 私有 CA 提供 HTTPS），对外是 OpenAI 兼容的 `api.internal/v1`，用令牌、额度、倍率、限流控制成本与滥用，踩过的坑（PG 初始化失败、证书信任）都沉淀成了运维文档。规模是个人/小团队单副本，但我清楚往多副本、数据库高可用演进的路径。

---
