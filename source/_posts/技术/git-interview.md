---
title: Git 面试问答（26 题）
date: 2026-08-27 09:50:00
categories: 技术
tags:
  - Git
  - 面试
---

本文整理了Git 面试问答（26 题）相关的 26 个高频面试问题，从基础到进阶再到生产实战层层递进，覆盖Git、面试等核心考点，每题附参考回答与追问，适合面试前系统复习。

<!--more-->

> 适用岗位：运维工程师 / 技术支持工程师 / AI 运维工程师 / DevOps 工程师

## 一、岗位高频速查

| 岗位 | 必考问题（3-5 个）与一句话要点 |
|---|---|
| 运维工程师 | ① 线上出事故怎么回滚？→ 优先 revert（保历史、可审计），别用 reset；② 误删分支/文件怎么恢复？→ reflog；③ merge 与 rebase 怎么取舍？→ 共享分支用 merge、本地私有提交用 rebase；④ Git 与 CI/CD 怎么配合？→ push 触发构建、tag 触发发布 |
| 技术支持工程师 | ① 冲突怎么产生、怎么解决？→ 双方改同一处，手动保留正确内容后 add/commit；② fork + PR/MR 协作流程？→ 先同步 upstream 再提 PR；③ 用户误提交/误删文件怎么救？→ reset --soft 撤提交、reflog 恢复；④ 怎么定位"哪个版本引入的问题"？→ git bisect 二分 |
| AI 运维工程师 | ① 模型权重、数据集这类大文件怎么进仓库？→ Git LFS，仓库只存指针；② 配置/模型版本如何回滚？→ 不可变 tag + 整体回滚；③ 配置漂移怎么追踪？→ 配置即代码入库，审计看 commit；④ 流水线怎么触发？→ push 到指定分支/tag 触发训练、评测、部署 |
| DevOps 工程师 | ① 分支策略怎么选？→ Git Flow 还是 Trunk-based，按团队规模定；② 流水线触发原理？→ Webhook 的 push/tag/PR 事件；③ 提交信息规范？→ Conventional Commits，可自动生成 changelog 和版本号；④ 保护分支怎么配？→ 强制 PR + CI 通过 + Code Review |
| 其他岗位（前端、测试等） | 低频，了解即可；会问基础三区、pull/push、回滚即可 |

## 二、基础篇（10 题）

### Q1. Git 的三个区是什么？add、commit 分别做了什么？

- 【考察点】面试官想验证你对"工作区 / 暂存区（index）/ 版本库（HEAD）"模型的理解，这是 Git 一切操作的基石，几乎必问。
- 【参考回答】先给结论：Git 有三层，工作区是你眼睛能看到的文件目录，暂存区（也叫 index）是 `add` 之后待提交的快照，版本库（HEAD）是 `commit` 之后的历史。流程就是"工作区 → add → 暂存区 → commit → 版本库 → push → 远程"。`git add` 只把改动放进暂存区，随时可以反悔；`git commit` 才把暂存区固化成一次不可变的历史提交。我平时就是靠"先 add 看清楚再 commit"来避免误提交。
- 【追问】
  - Q：`git commit -a` 是什么？→ 跳过 add，直接提交所有"已跟踪文件"的改动，但新文件仍然必须先 add，`-a` 不会帮你跟踪新文件。
  - Q：`git diff`、`git diff --cached`、`git diff HEAD` 有什么区别？→ 分别是"工作区 vs 暂存区""暂存区 vs 版本库""工作区 vs 版本库"，写代码时用第一个，commit 前用第二个检查。
  - Q：add 错了怎么撤销？→ `git restore --staged <file>`（旧版是 `git reset HEAD <file>`），只把文件从暂存区拿出来，改动不丢。
- 【岗位标注】通用

### Q2. clone、pull、fetch 有什么区别？

- 【考察点】远程协作的基础概念，重点看是否知道"fetch 只下载不合并"这个关键区别。
- 【参考回答】clone 是第一次把远程仓库完整复制到本地；fetch 只把远程的最新提交拉到本地缓存里，不合并、不动你的工作区；而 pull = fetch + merge 两步合一。所以我会跟新人说：想"先看看远程有什么再决定"，就用 `git fetch` 然后自己比较；确定要同步才用 pull。养成先 fetch 后操作的习惯，能避免不少意外。
- 【追问】
  - Q：`git pull --rebase` 什么时候用？→ 本地有未推送提交、又不想产生多余 merge commit 时，用 rebase 方式拉取，历史更干净。
  - Q：远程分支被删了，本地怎么清理？→ `git fetch --prune` 或 `git remote prune origin`，删除本地残留的远程跟踪分支。
- 【岗位标注】通用 / 运维

### Q3. 如何创建、切换、合并、删除分支？

- 【考察点】分支基本操作是否熟练，以及有没有分支命名规范意识。
- 【参考回答】创建并切换用 `git checkout -b feature/xxx`（或新版 `git switch -c`），合并用 `git merge feature/xxx`，删除已合并的分支用 `git branch -d feature/xxx`。命名我习惯按团队规范来：`feature/` 新功能、`fix/` 修 bug、`hotfix/` 紧急修复、`release/x.y.z` 发布分支，全部小写加短横线，一眼能看出用途。
- 【追问】
  - Q：切换分支前有未提交的改动怎么办？→ 最稳妥是先 commit 或 stash；不冲突的改动 Git 允许直接带过去，但风险自负，我一般先 stash。
  - Q：`git branch -d` 和 `-D` 区别？→ `-d` 只允许删已合并的分支（安全），`-D` 强制删除，可能丢提交，需谨慎。
- 【岗位标注】通用 / 技术支持

### Q4. 什么是冲突？完整的解决流程是什么？

- 【考察点】冲突是团队协作的高频场景，技术支持岗必考，重点看流程是否完整、是否懂中止合并。
- 【参考回答】冲突的本质是两个人改了同一段代码，Git 不知道该保留谁，就在冲突文件里插入 `<<<<<<<`、`=======`、`>>>>>>>` 三段标记。标准解决流程四步：① 打开文件找到标记，和对方沟通确认保留哪边（或两边都要）；② 删掉标记、保留正确内容；③ `git add <file>` 告诉 Git 这个文件解决了；④ `git commit` 完成合并。千万不要整文件乱删，也千万别跳过 add 直接 commit。
- 【追问】
  - Q：合并到一半想放弃怎么办？→ `git merge --abort` 干净地回到合并前状态。
  - Q：怎么减少冲突？→ 小步提交、勤 pull、避免多人同时动同一文件或同一行、大改动拆小并提前通知团队。
- 【岗位标注】技术支持 / 通用

### Q5. 怎么看提交历史？git log 常用参数有哪些？

- 【考察点】日常排查必备技能，考察对 log 参数和 blame 的熟悉度。
- 【参考回答】最常用的是 `git log --oneline --graph --decorate --all`，一屏看清所有分支的分叉和拓扑；看具体改动用 `git log -p` 或 `git log --stat`；按人筛 `git log --author=xxx`；按时间筛 `--since="2 weeks ago"`；要查某一行是谁改的用 `git blame <file>`，定位线上问题特别管用。我排查"这段代码什么时候加的"基本就是这几个组合。
- 【追问】
  - Q：怎么找某段代码是哪个提交删掉的？→ `git log -S '关键字' -- <file>`（pickaxe），专门搜"内容增删"。
  - Q：`git log --stat` 和 `-p` 区别？→ `--stat` 只列改了哪些文件、增删多少行；`-p` 显示完整 diff。
- 【岗位标注】通用 / 运维

### Q6. 怎么撤销/回滚？reset 和 revert 的区别？

- 【考察点】核心考点之一，要求分清"改写历史"和"追加反向提交"，并知道已推送代码的正确姿势。
- 【参考回答】一句话结论：reset 移动 HEAD 指针、改写历史，只适合本地未推送的提交；revert 是新增一个反向提交、保留全部历史，适合已推送的共享分支。reset 有三档，`--soft` 只撤 commit、`--mixed` 连暂存区一起撤、`--hard` 全丢。已推到远端的分支我永远用 revert：`git revert <hash>`，因为 reset 会破坏别人的本地历史。
- 【追问】
  - Q：`git reset --hard HEAD~1` 之后文件还能找回吗？→ 能，reflog 里有记录，找到 hash 再 reset 回去即可，Git 没那么容易真丢数据。
  - Q：撤销一个 merge commit 呢？→ `git revert -m 1 <merge-commit-hash>`，`-m 1` 指定保留哪条父分支。
- 【岗位标注】通用 / 运维 / DevOps

### Q7. stash 是什么？什么时候用？

- 【考察点】典型工作场景题，考察是否真的在开发/维护中用过，而不只是背命令。
- 【参考回答】stash 是把当前未提交的改动临时存起来，让工作区恢复干净。典型场景：写博客改到一半，突然线上要紧急修复，先 `git stash` 保存，切分支修完，再切回来 `git stash pop` 取回。配套 `git stash list` 查看、`git stash drop` 清理。注意 pop 时也可能冲突，冲突了就正常解决再 drop。
- 【追问】
  - Q：只想 stash 某一个文件？→ `git stash push <file>`，只存指定文件。
  - Q：stash 会保存新文件（untracked）吗？→ 默认不会，需要加 `-u` 或 `--include-untracked`。
- 【岗位标注】通用 / 技术支持

### Q8. 怎么把某个提交单独拿到当前分支？cherry-pick 怎么用？

- 【考察点】cherry-pick 是运维和 DevOps 高频操作（hotfix 多分支同步），考察是否理解"拿单个提交"与 merge 的区别。
- 【参考回答】cherry-pick 就是把指定提交的改动原样重放到当前分支，生成一个新提交：`git cherry-pick <commit-hash>`。典型场景是 hotfix 在 release 分支修好，也要同步到 main：切到 main 执行 cherry-pick。如果冲突，解决后 `git cherry-pick --continue`；不想要了可以 `git cherry-pick --abort`。它和 merge 的区别是 merge 合整条分支，cherry-pick 只拿单个提交。
- 【追问】
  - Q：一次拿多个提交？→ `git cherry-pick A B C` 按顺序拿，或用区间 `A..B`。
  - Q：cherry-pick 出来的提交和原来的 hash 一样吗？→ 不一样，相当于重放生成新提交，hash 必然不同。
- 【岗位标注】运维 / DevOps

### Q9. tag 是什么？发布版本怎么打 tag？

- 【考察点】发布流程基础，重点看是否知道"附注标签"和"tag 触发 CI 发布"。
- 【参考回答】tag 是给某个 commit 贴一个不可变的名字，一般就是版本号，发布时用：`git tag -a v1.0.0 -m "release v1.0.0"`（附注标签，带作者、时间、说明，推荐），推送用 `git push origin v1.0.0` 或 `git push --tags`。tag 的最大价值是不可变——同一个 tag 永远指向同一个 commit，所以回滚=部署旧 tag，可复现、可审计。CI 里也常监听 tag 事件触发正式发布流水线。
- 【追问】
  - Q：轻量标签和附注标签区别？→ 轻量的只是指针，附注的是完整对象（含 tagger、时间、说明，可签名），正式发布用附注。
  - Q：忘了打 tag，还能补吗？→ 找到对应 commit hash，`git tag -a v1.0.0 <hash>` 补上，注意别把 tag 顺序打乱。
- 【岗位标注】运维 / DevOps

### Q10. 远程协作：fork + PR/MR 流程是什么？upstream 是什么？

- 【考察点】开源与团队协作标准流程，技术支持岗重点，也正好呼应简历里的开源项目经历。
- 【参考回答】参与别人的仓库（或公司大仓库）时，先 fork 到自己名下，clone 后把原仓库加为 upstream：`git remote add upstream <原仓库URL>`。日常先 `git fetch upstream && git rebase upstream/main` 保持和上游同步，再在自己分支改代码、push 到自己的 fork，最后在网页上提 PR（GitLab 叫 MR）。origin 是自己的 fork，upstream 是官方原仓库，这个区别一定要说清。我自己维护开源项目和博客 PR 时就是这个流程，提 PR 前一定先同步，避免无谓冲突。
- 【追问】
  - Q：PR 被 reviewer 要求修改怎么办？→ 在本地同一个分支继续提交、push 到同一个分支，PR 会自动更新，千万不要重新开 PR。
  - Q：upstream 怎么更新到最新？→ `git fetch upstream` 后用 `git rebase upstream/main`（本地未推送时），干净且线性。
- 【岗位标注】通用 / 技术支持

## 三、进阶篇（9 题）

### Q11. merge 和 rebase 的本质区别？什么时候用哪个？

- 【考察点】最经典的原理题，考察的不只是概念，而是工程取舍判断。答"rebase 更好"直接翻车。
- 【参考回答】先给结论：两者不是谁优谁劣，是历史呈现方式的取舍。merge 保留双方真实的分叉历史，多一个 merge commit，历史是网状的但信息完整、可追溯；rebase 把你的提交"拆下来重放到目标分支顶端"，历史线性好看，但等于改写了提交，hash 全部变化。我的原则很简单：团队共享分支（main/release）绝不 rebase，只用 merge；自己本地没推送的分支随便 rebase 整理，push 之前把历史擦干净。一句话总结：merge 保真相，rebase 保整洁。
- 【追问】
  - Q：rebase 冲突和 merge 冲突解决有什么不同？→ merge 一次解完；rebase 是逐个提交重放，可能要解好几次，每解一次 `git add` 后 `git rebase --continue`。
  - Q：已经推送的分支能 rebase 吗？→ 能但必须强推，且会破坏所有已 clone 的人，除非团队约定 + `--force-with-lease`，否则不要动。
- 【岗位标注】通用 / DevOps

### Q12. `git pull` 和 `git pull --rebase` 产生的历史有什么不同？

- 【考察点】细节题，很多人知道命令不知道差异，答出"默认 pull 是 fetch+merge"就赢一半。
- 【参考回答】pull 默认等于 fetch + merge：本地有未推送提交时，会把远程历史并进来，产生一个 merge commit，历史出现分叉点；而 `--rebase` 是把本地提交垫到远程最新提交后面，历史是纯线性的。所以本地提交多、在意历史整洁时用 `--rebase`，甚至可以 `git config --global pull.rebase true` 全局默认。但团队若要求保留 merge 记录（比如 Git Flow 的 release 合回 main），就得用默认 merge 方式。
- 【追问】
  - Q：拉取时不想有任何自动操作怎么办？→ 用 `git fetch` 自己看差异，再决定 merge 还是 rebase，最可控。
- 【岗位标注】通用 / DevOps

### Q13. reset 的三种模式（soft/mixed/hard）到底动了什么？

- 【考察点】必背考点，要求把"HEAD / 暂存区 / 工作区"三层对应到三种模式，能举使用场景。
- 【参考回答】记口诀：reset 移动 HEAD，模式决定"丢到哪一层"。`--soft` 只把 HEAD 移回去，暂存区和工作区都不动，改动还在暂存区，适合"commit 错了想重新提交"；`--mixed`（默认）连暂存区一起回退，改动退回到工作区，适合"想重新整理提交"；`--hard` 暂存区、工作区全部清空，彻底回到目标提交，适合确认要丢弃的场景（用前先 stash 或看一眼 reflog）。对应关系就是：soft 少动一层、mixed 动两层、hard 三层全动。
- 【追问】
  - Q：reset 到别的分支的 commit 可以吗？→ 可以，`git reset --hard <hash>` 本质就是把当前分支指针移过去，等于从那个提交重新出发。
  - Q：已经 push 的提交能 reset 吗？→ 不要，会破坏协作者的本地历史，已推送的一律用 revert。
- 【岗位标注】通用 / 运维

### Q14. reflog 是什么？误删的分支/文件怎么恢复？

- 【考察点】"救命技能"，考察对 Git 内部模型的理解——分支只是指针，commit 不会立刻消失。
- 【参考回答】reflog 记录的是本地所有 HEAD 移动的历史，包括 reset、rebase、删分支前的状态，`git reflog` 能看到每个操作前后的 commit hash。恢复误删分支：reflog 里找到该分支最后一次指向的 hash，`git checkout -b <分支名> <hash>` 重建。恢复误删文件：找到删除前的提交 `git checkout <hash> -- <file>`。原理是分支只是个指针，commit 对象还在对象库里，reflog 默认保留 90 天左右，所以"几天内基本都能救回来"。
- 【追问】
  - Q：reflog 会永久保留吗？→ 不会，默认约 90 天（gc.reflogExpire 控制），所以出事后越早恢复越好。
  - Q：为什么删了分支还能恢复？→ 分支只是引用 commit 的指针，删除只删引用，commit 对象还在，没被 gc 前随时可以重新指向它。
- 【岗位标注】通用 / 运维

### Q15. 提交信息规范（Conventional Commits）是什么？为什么重要？

- 【考察点】团队协作素养，考察规范意识和自动化思维（changelog、版本号、CI 校验）。
- 【参考回答】格式是 `type(scope): subject`，比如 `feat: 新增用户登录`、`fix(api): 修复超时问题`、`docs: 更新使用说明`。价值有三个：一是 git log 可读性高，扫一眼就知道每次改了什么；二是配合工具能自动生成 changelog 和自动计算版本号（feat 升 minor、fix 升 patch、BREAKING CHANGE 升 major）；三是 CI 可以校验提交格式，不合规直接拦截。我的博客更新也走这套，`docs:` 记文章和文档改动，GitHub 上的 commit 历史一眼可读。
- 【追问】
  - Q：常见的 type 有哪些？→ feat/fix/docs/style/refactor/perf/test/chore/build/ci，各自职责明确。
  - Q：subject 怎么写才算好？→ 祈使句、说"做了什么"不说"怎么做的"、尽量短（50 字符内），如 `fix: 修复空指针导致服务崩溃`。
- 【岗位标注】通用 / DevOps

### Q16. submodule 是什么？有什么坑？什么时候用它？

- 【参考回答】submodule 是在主仓库里引用另一个仓库的某个 commit 指针：`git submodule add <url> path`。克隆带子模块的仓库必须 `git submodule update --init --recursive`。它的坑很多：子模块内容更新了主仓库不会自动感知、切分支时子模块指针容易漂移、CI 里忘 init 直接构建失败、协作时"我改了子模块别人看不到"。我的经验是能用依赖管理（npm/pip）或 Git LFS 解决的就不用 submodule；必须用时，把 init/update 步骤写进 CI 脚本和 README，避免踩坑。
- 【追问】
  - Q：子模块改了代码，主仓库那边看到什么？→ 看到子模块是 dirty 状态，需要先到子模块内提交并 push，再回主仓库更新指针并提交，两步缺一不可。
  - Q：submodule 和 Git LFS 的区别？→ LFS 管的是"大文件"，仓库结构不变；submodule 管的是"另一个独立项目"，是嵌套的仓库关系。
- 【岗位标注】运维 / DevOps

### Q17. 撤销操作大全：误改、误 add、误提交、误删、改错分支分别怎么救？

- 【考察点】综合实战题，考察是否形成"按场景选命令"的肌肉记忆，比单问命令难得多。
- 【参考回答】按场景背：① 误改文件没 add → `git restore <file>`；② 误 add → `git restore --staged <file>`；③ 误 commit 没推送 → `git reset --soft HEAD~1` 后重新提交；④ 误 commit 已推送 → `git revert <hash>`，不动历史；⑤ 提交到了错误分支 → 先在错误分支 `git reset --soft HEAD~1` 保留改动，切到正确分支重新 commit（或 cherry-pick）；⑥ 误删文件 → `git checkout <hash> -- <file>` 从历史恢复。核心判断就一句：没推送随便改，已推送用 revert。
- 【追问】
  - Q：想修改上一个 commit 的信息或内容？→ `git commit --amend`，但只 amend 还没推送的提交，推送过的会历史分叉。
  - Q：改错分支最标准的做法？→ 错误分支 `git reset --soft HEAD~1` 保住改动 → `git switch <正确分支>` → `git commit`，改动一行不丢。
- 【岗位标注】通用 / 技术支持

### Q18. Git 与 CI/CD 是怎么配合的？（结合你的博客自动部署）

- 【考察点】简历强相关：博客是 Git + Pages 自动部署的活例子，考察能否讲清"Git 事件 → 流水线触发 → 部署"链路。
- 【参考回答】Git 是 CI/CD 的触发器：push 到指定分支触发构建测试，打 tag 触发正式发布，PR 触发预检（lint、测试、构建预览）。我的博客就是最朴素的例子：用 Git 管理内容，绑定 Cloudflare Pages / GitHub Pages 后，每次 push 到 main 自动构建部署，这就是最简单的 GitOps。CI 里通常做的事：checkout 代码 → 装依赖 → 跑测试 → 构建产物 → 按 tag 打版本、发布。要注意 CI 环境里的凭证（SSH key / deploy token）和子模块初始化，否则构建会莫名其妙失败。
- 【追问】
  - Q：流水线里怎么区分分支或 tag？→ 读环境变量，如 GitHub Actions 的 `$GITHUB_REF`、GitLab 的 `$CI_COMMIT_BRANCH` / `$CI_COMMIT_TAG`，用 `refs/tags/*` 匹配 tag 事件。
  - Q：怎么防止坏代码被部署上线？→ 保护分支：main 禁止直接 push，必须走 PR 且 CI 通过 + Code Review 才能合入。
- 【岗位标注】运维 / AI 运维 / DevOps

### Q19. 怎么定位"哪个提交引入了这个 bug"？

- 【参考回答】用 `git bisect` 二分定位。步骤：`git bisect start`，`git bisect bad` 标记当前是坏的，`git bisect good <还正常的commit>` 标记好的，然后 Git 自动跳到中间提交，我测试后 `git bisect good` 或 `git bisect bad` 反馈，几步之内就锁定了罪魁祸首，最后 `git bisect reset` 退出。几百个提交通常 10 次以内就能定位，比人肉翻 log 高效太多，是排查回归 bug 的利器。
- 【追问】
  - Q：能自动化吗？→ 可以，写个测试脚本 `git bisect run <脚本>`，全自动二分，跑完直接给出第一个坏提交。
  - Q：为什么这么快？→ 二分查找，2 的 n 次方个提交约 n 次判定，几千个提交也就 12 次左右。
- 【岗位标注】运维 / 技术支持

## 四、生产实战·刁钻篇（7 题）

### Q20. 同事把密码/密钥 push 进了仓库，怎么办？

- 【考察点】安全事故处理，考察"止血 + 清洗历史 + 团队同步"的完整思维，很多人只会说"删掉这个提交"。
- 【参考回答】分两步，先止血再清洗。第一步：去密钥平台吊销并轮换密钥——密钥一旦进了 Git 历史就算泄露，删提交不等于删泄露，必须轮换，这是底线。第二步：清洗历史，用 `git filter-repo --replace-text <替换规则文件>` 把密钥批量替换成占位符（官方推荐 filter-repo，别用又慢又坑的 filter-branch），然后 `git push --force-with-lease` 强推，并通知所有协作者重新 fetch、不要基于旧历史继续开发。结论：密钥必须轮换，历史重写必须全团队配合，单打独斗没用。
- 【追问】
  - Q：为什么不用 `filter-branch`？→ Git 官方文档已推荐 filter-repo 替代，filter-branch 慢、对复杂历史（tag、merge）容易出错；BFG Repo-Cleaner 也是备选。
- 【岗位标注】运维 / DevOps

### Q21. 手滑 `git reset --hard` 丢了大半天的工作，怎么救？

- 【考察点】事故应急 + 对对象库的理解，答"没救了"直接挂。
- 【参考回答】别慌，先 `git reflog`，找到 reset 之前 HEAD 指向的 hash（通常就在 reflog 前几条），然后 `git reset --hard <那个hash>`，全部回来。原理是 reset 只移动指针，commit 对象还在对象库里，reflog 默认留 90 天，所以基本都能救。如果 reflog 也被清了（比如新 clone 的仓库），还可以 `git fsck --lost-found` 找 dangling commit 碰碰运气，或者看 stash、IDE 的本地历史。
- 【追问】
  - Q：恢复后为什么有时文件还是不对？→ 可能 reset 之前还有未提交的改动，那些本来就没进 commit，reflog 也救不了；所以高危操作前先 stash 或 commit 一份。
- 【岗位标注】通用 / 运维

### Q22. rebase 中途冲突太多想放弃，或者 rebase 到一半想换策略怎么办？

- 【考察点】rebase 事故处理，考察 abort/continue/skip 的区分和"残局不硬闯"的判断力。
- 【参考回答】想放弃就 `git rebase --abort`，干净回到 rebase 前，任何一步都能用。想继续就逐个解决冲突：每个冲突文件改好、`git add` 后 `git rebase --continue`，Git 会继续重放下一个提交；某个提交确实不要了可以 `git rebase --skip`。如果是 rebase 到一半想换 merge 策略，先 `--abort` 再重新决策，别在残局上叠加操作。另一点要注意：rebase 是逐个提交重放，可能解好几次冲突，这和 merge 一次解决不一样。
- 【追问】
  - Q：强推时为什么用 `--force-with-lease` 而不是 `--force`？→ lease 会先检查远程是否还是自己上次 fetch 的状态，防止覆盖别人刚 push 的提交，是带安全校验的强推；裸 `--force` 可能毁掉同事的工作。
- 【岗位标注】DevOps

### Q23. 模型权重/数据集这类大文件被误提交，仓库越来越大怎么办？

- 【考察点】AI 运维强相关（模型、数据集版本管理），考察 LFS 认知和历史清理能力。
- 【参考回答】两步走。第一步停跟踪并清理历史：`git rm --cached <大文件>` 停止跟踪，再用 `git filter-repo --path <大文件> --invert-paths` 把该路径从全部历史中抹掉，然后强推并让所有人重新 clone（历史重写后老 clone 无法正常合并）。第二步建长期方案：大文件走 Git LFS，`git lfs track "*.pth"`（模型权重、数据集等），仓库里只存指针，真正内容存在 LFS 服务器，clone 时才按需拉取，仓库体积瞬间降下来。LFS 在 AI 运维里几乎是标配。
- 【追问】
  - Q：LFS 有什么坑？→ 平台有配额限制；CI 里要 `git lfs install`；没装 LFS 的同事 clone 下来文件是空的占位文件，要在文档里写清楚。
- 【岗位标注】AI 运维 / 运维

### Q24. 本地 main 落后远程很多，本地又有未推送提交，怎么安全同步？

- 【考察点】diverged（分叉）状态的处理，考察 fetch 先行和 rebase/merge 的临场选择。
- 【参考回答】第一步永远是 `git fetch` 看清差距，别直接 pull 造成冲突海啸。然后分情况：本地只有少量提交 → 优先 `git rebase origin/main`，把本地提交垫到最新，历史线性；本地提交很多、或团队不追求线性 → 直接 `git merge origin/main` 一次解决冲突。如果有未提交的改动，先 `git stash` 再同步。原则重申：未推送的提交随便整理，已推送的用 `--force-with-lease`，且要团队知情。
- 【追问】
  - Q："diverged"是什么状态？→ 本地和远程各自有对方没有的提交，无法快进，必须 merge 或 rebase 二选一，这正是我们刚处理的情况。
- 【岗位标注】通用 / 运维

### Q25. 反直觉题：push 之后 status 还显示 ahead，或 pull 提示已最新但远程明明有更新？

- 【考察点】最容易踩的坑：status 比较的是本地缓存的远程跟踪分支，不是真正的远程。答对这一个细节，深度立刻不一样。
- 【参考回答】原因是 `git status` 比较的是当前分支和"本地缓存的远程跟踪分支"（origin/main），不是实时远程！远程有新提交时，本地缓存没刷新，status 自然显示 up to date；同理 ahead 表示本地还有没推送的提交。所以动手前先 `git fetch --all --prune` 刷新缓存，status 才准确。我的习惯是：任何同步操作前先 fetch，再拿两个命令看差异——`git log origin/main..main` 看本地多什么，`git log main..origin/main` 看远程多什么。
- 【追问】
  - Q：那"远程真的没有新东西"怎么确认？→ fetch 之后用上面两个 log 命令确认两边都为空，就是真同步了。
- 【岗位标注】通用 / 运维

### Q26. 线上出事故，最快的回滚姿势是什么？

- 【考察点】压轴场景题，考察回滚分层思维：应用层切流 → Git 层 revert → 整体回滚到稳定 tag，而不是"上来就 reset"。
- 【参考回答】按梯队来：① 如果发布系统/网关能切流量，先切流量到上一版本（蓝绿/金丝雀），代码回滚只是兜底；② Git 层用 `git revert <坏提交hash>` 生成反向提交推上去触发 CI 重新部署，绝不用 reset——线上历史要保留、多人协作要安全；③ 更稳的姿势：给每个稳定版本打不可变 tag，回滚 = 部署旧 tag，可复现可审计。我自己博客出过内容事故，就是 revert 后 push，Pages 自动重新构建，几分钟恢复。核心教训：回滚要快、要可审计、越慌越不能 reset --hard。
- 【追问】
  - Q：只 revert 单个坏提交，但它依赖的新功能还在，会出问题吗？→ 会，单提交 revert 可能留下依赖残缺；生产事故优先"整体回滚到上一稳定版本"，revert 单个提交用于普通小修复。
- 【岗位标注】运维 / AI 运维 / DevOps
