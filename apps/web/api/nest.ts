// Vercel 只把 apps/web/api/ 下的文件当作 Serverless Function；
// 实际逻辑仍在 apps/api，这里仅作入口转发。
export { default } from "../../api/src/serverless"
