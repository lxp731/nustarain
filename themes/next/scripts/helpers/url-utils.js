'use strict';

/**
 * Node.js 已弃用 url.parse()（DEP0169），这里用 WHATWG URL 提供等价的最小实现。
 * 只保留主题用到的两个字段：protocol（含冒号，如 'https:'）、hostname（不含端口）。
 * 相对路径、协议相对路径等无法直接用 new URL() 解析的输入返回空串，
 * 与旧版 url.parse() 返回 null 时的真假判断结果保持一致。
 */
function parseUrl(input) {
  try {
    const url = new URL(input);
    return { protocol: url.protocol, hostname: url.hostname };
  } catch {
    return { protocol: '', hostname: '' };
  }
}

function hostnameOf(input) {
  return parseUrl(input).hostname;
}

module.exports = { parseUrl, hostnameOf };
