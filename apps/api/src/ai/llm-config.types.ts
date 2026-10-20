/** OpenAI 兼容接口连接参数，由用户个人中心或（可选）部署环境变量提供。 */
export type LlmConnectionConfig = {
  apiKey: string
  baseUrl: string
  model: string
}
