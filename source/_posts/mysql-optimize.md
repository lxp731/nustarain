---
title: MySQL 优化
tags:
  - 面试
date: 2025-06-25 21:59:09
categories: 理论知识
---

### 优化清单

1. 数据库架构优化
  * 合理的表结构：垂直拆分(按业务)、水平拆分(按数据量)。
  * 读写分离：主库写、从库读。
  * 使用缓冲：Redis 缓存。
<!-- more -->
2. SQL 语句优化
  * 避免使用 `SELECT *`。
  * 合理使用索引：为 `WHERE`、`JOIN`、`ORDER BY` 条件创建合适索引。
  * 避免全表扫描：使用 `EXPLAIN` 语句查看 SQL 语句执行计划。
  * 减少子查询：使用 `JOIN` 替代子查询。
  * 批量操作： 使用批量 `INSERT/UPDATE` 减少网络开销。

3. 服务器参数优化
  * 内存
    ```ini
    innodb_buffer_pool_size = 总内存的50-70%
    innodb_log_buffer_size = 16-64MB
    key_buffer_size = 适用于MyISAM
    query_cache_size = 查询缓存(MySQL 8.0已移除)
    ```

  * IO
    ```ini
    innodb_io_capacity = 200-2000(根据磁盘性能调整)
    innodb_flush_method = O_DIRECT(推荐)
    innodb_flush_neighbors = 0(SSD建议关闭)
    ```
  
  * 连接
    ```ini
    max_connections = 合理设置连接数(默认151)
    thread_cache_size = 线程缓存大小
    wait_timeout = 连接空闲超时时间
    ```

4. 事务优化

  * 合理设置隔离级别：通常 READ COMMITTED 或 REPEATABLE READ
  * 控制事务大小：避免大事务
  * 减少锁等待：优化事务执行时间
  * 使用乐观锁：减少锁争用

5. 表结构优化

  * 选择合适的数据类型：能用 INT 不用 BIGINT
  * 避免 NULL 字段：NULL 会增加处理复杂度
  * 规范化与反规范化平衡：适当冗余提高查询性能
  * 合理使用分区表：按时间/范围分区

6. 监控与分析工具

  * 慢查询日志：slow_query_log=1, long_query_time=2
  * EXPLAIN：分析 SQL 执行计划
  * Performance Schema：监控服务器事件
  * SHOW PROFILE：查看语句执行细节
  * pt-query-digest：分析慢查询日志

### 优化参考

```sql
-- 优化前
SELECT * FROM orders WHERE user_id = 100 AND status = 'completed' ORDER BY create_time DESC;

-- 优化后
ALTER TABLE orders ADD INDEX idx_user_status_time(user_id, status, create_time);
SELECT id, user_id, amount, create_time 
FROM orders 
WHERE user_id = 100 AND status = 'completed' 
ORDER BY create_time DESC LIMIT 100;
```