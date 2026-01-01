import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import type { TableData } from "../shared/types";

// Schema definitions
const tableDataSchema = z.object({
  headers: z.array(z.string()),
  rows: z.array(z.array(z.string())),
});

// Helper function to parse LLM response as JSON
function parseJsonResponse<T>(content: string): T {
  // Try to extract JSON from markdown code blocks
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
  return JSON.parse(jsonStr) as T;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Table operations
  table: router({
    // Recognize table from image - STRICTLY preserve original format
    recognizeFromImage: publicProcedure
      .input(z.object({
        imageBase64: z.string(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { imageBase64, description } = input;

        const systemPrompt = `你是一个专业的表格识别助手。你的任务是从图片中**精确识别**表格内容，并将其转换为结构化的JSON格式。

**重要规则 - 必须严格遵守：**
1. **严格保持原表格结构**：不要添加、删除或修改任何列
2. **严格保持原表格行数**：不要添加或删除任何行
3. **精确复制单元格内容**：完全按照图片中显示的文字内容填写，不要修改、翻译或"优化"任何内容
4. **保持空单元格**：如果图片中某个单元格是空的，在输出中使用空字符串""表示
5. **保持原始顺序**：行和列的顺序必须与图片中完全一致
6. **不要推测或补充**：只识别图片中实际存在的内容，不要添加任何额外信息

请以JSON格式返回结果：
{
  "title": "根据表格内容推断的简短标题",
  "tableData": {
    "headers": ["原表格第一列标题", "原表格第二列标题", ...],
    "rows": [
      ["第一行第一列内容", "第一行第二列内容", ...],
      ["第二行第一列内容", "第二行第二列内容", ...]
    ]
  }
}`;

        const userPrompt = description 
          ? `请精确识别这张图片中的表格内容，严格保持原表格的格式和结构。用户描述：${description}`
          : `请精确识别这张图片中的表格内容，严格保持原表格的格式和结构，不要改变或增加任何内容。`;

        const result = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                { type: "text", text: userPrompt },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/jpeg;base64,${imageBase64}`,
                    detail: "high",
                  },
                },
              ],
            },
          ],
        });

        const responseContent = result.choices[0]?.message?.content;
        if (!responseContent || typeof responseContent !== 'string') {
          throw new Error("Failed to get response from LLM");
        }

        try {
          const parsed = parseJsonResponse<{
            title?: string;
            tableData: TableData;
          }>(responseContent);

          return {
            title: parsed.title,
            tableData: parsed.tableData,
          };
        } catch (e) {
          console.error("Failed to parse LLM response:", e);
          return {
            title: "识别的表格",
            tableData: {
              headers: ["列1", "列2", "列3"],
              rows: [["无法识别", "", ""]],
            },
          };
        }
      }),

    // Search and fill table - ONLY update specific column content, keep row structure unchanged
    searchAndFill: publicProcedure
      .input(z.object({
        tableData: tableDataSchema,
        instruction: z.string(),
      }))
      .mutation(async ({ input }) => {
        const { tableData, instruction } = input;

        // Format the current table for the prompt
        const tableDescription = tableData.rows.map((row, idx) => {
          const rowDesc = tableData.headers.map((header, colIdx) => `${header}: "${row[colIdx] || ''}"`).join(', ');
          return `第${idx + 1}行: { ${rowDesc} }`;
        }).join('\n');

        const systemPrompt = `你是一个智能表格助手。用户有一个固定结构的表格，需要你根据搜索指令为表格中的每一行填充内容。

**当前表格结构（绝对不能改变）：**
- 表头：${JSON.stringify(tableData.headers)}
- 列数：${tableData.headers.length}
- 行数：${tableData.rows.length}

**当前表格内容：**
${tableDescription}

**核心规则 - 必须严格遵守：**
1. **行数必须保持不变**：原表格有${tableData.rows.length}行，返回的表格也必须是${tableData.rows.length}行
2. **列数必须保持不变**：原表格有${tableData.headers.length}列，每行必须有${tableData.headers.length}个元素
3. **表头必须保持不变**：表头必须是 ${JSON.stringify(tableData.headers)}
4. **第一列（通常是字段名/项目名）必须保持不变**：这是表格的结构标识，不能修改
5. **只能更新内容列**：根据用户指令，只更新需要填充的列（通常是最后一列或"内容"列）
6. **按行匹配填充**：根据每行第一列的字段名称，搜索对应的内容填入

**填充逻辑示例：**
假设表格是：
| 字段名称 | 是否必填 | 提示/示例内容 |
| 案件类型 | 是 | 刷单返利诈骗 |
| 受骗人视角 | 是 | 我当时正在找兼职... |

用户指令："搜索网络诈骗案例信息"

你应该：
1. 保持"字段名称"列不变（案件类型、受骗人视角）
2. 保持"是否必填"列不变（是、是）
3. 只更新"提示/示例内容"列，根据每行的字段名称搜索对应内容

返回JSON格式：
{
  "tableData": {
    "headers": ${JSON.stringify(tableData.headers)},
    "rows": [
      ${tableData.rows.map((row, i) => `["${row[0] || ''}", ... 保持前面列不变, "根据第一列'${row[0]}'搜索到的新内容"]`).join(',\n      ')}
    ]
  },
  "searchSummary": "说明为每个字段填充了什么内容"
}`;

        const result = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `请根据以下指令，为表格中的每一行搜索并填充对应内容。注意：保持表格结构不变，只更新需要填充的内容列。\n\n指令：${instruction}` },
          ],
        });

        const responseContent = result.choices[0]?.message?.content;
        if (!responseContent || typeof responseContent !== 'string') {
          throw new Error("Failed to get response from LLM");
        }

        try {
          const parsed = parseJsonResponse<{
            tableData: TableData;
            searchSummary?: string;
          }>(responseContent);

          // CRITICAL: Enforce original structure
          // 1. Force original headers
          parsed.tableData.headers = tableData.headers;

          // 2. Force original row count
          if (parsed.tableData.rows.length !== tableData.rows.length) {
            // If row count changed, try to match by first column
            const newRows: string[][] = tableData.rows.map((originalRow) => {
              const matchedRow = parsed.tableData.rows.find(
                (newRow) => newRow[0] === originalRow[0]
              );
              if (matchedRow) {
                // Keep original first column(s), use new content for last column(s)
                const result = [...originalRow];
                // Only update the last column with new content
                if (matchedRow.length >= tableData.headers.length) {
                  result[result.length - 1] = matchedRow[matchedRow.length - 1];
                }
                return result;
              }
              return originalRow; // Keep original if no match
            });
            parsed.tableData.rows = newRows;
          } else {
            // Row count matches, but ensure first column is preserved
            parsed.tableData.rows = parsed.tableData.rows.map((newRow, idx) => {
              const originalRow = tableData.rows[idx];
              // Ensure correct column count
              const result: string[] = [];
              for (let col = 0; col < tableData.headers.length; col++) {
                if (col === 0) {
                  // Always preserve first column (field name)
                  result.push(originalRow[col] || '');
                } else if (col < tableData.headers.length - 1) {
                  // For middle columns, prefer original unless explicitly different
                  result.push(originalRow[col] || newRow[col] || '');
                } else {
                  // Last column - use new content if available
                  result.push(newRow[col] || originalRow[col] || '');
                }
              }
              return result;
            });
          }

          // 3. Ensure each row has correct column count
          parsed.tableData.rows = parsed.tableData.rows.map((row, idx) => {
            const originalRow = tableData.rows[idx] || [];
            if (row.length < tableData.headers.length) {
              // Pad with original values or empty strings
              const padded = [...row];
              for (let i = row.length; i < tableData.headers.length; i++) {
                padded.push(originalRow[i] || '');
              }
              return padded;
            } else if (row.length > tableData.headers.length) {
              return row.slice(0, tableData.headers.length);
            }
            return row;
          });

          return {
            tableData: parsed.tableData,
            searchSummary: parsed.searchSummary,
          };
        } catch (e) {
          console.error("Failed to parse LLM response:", e);
          return {
            tableData,
            searchSummary: "处理失败，请重试",
          };
        }
      }),

    // Modify table content - STRICTLY follow original table structure
    modifyTable: publicProcedure
      .input(z.object({
        tableData: tableDataSchema,
        instruction: z.string(),
      }))
      .mutation(async ({ input }) => {
        const { tableData, instruction } = input;

        const systemPrompt = `你是一个智能表格助手，可以根据用户的自然语言指令修改表格内容。

**当前表格数据：**
${JSON.stringify(tableData, null, 2)}

**当前表格结构：**
- 表头：${JSON.stringify(tableData.headers)}
- 列数：${tableData.headers.length}
- 行数：${tableData.rows.length}

**重要规则：**
1. **默认保持表格结构不变**：除非用户明确要求，否则不要改变行数、列数和表头
2. **第一列通常是字段标识**：除非用户明确要求修改，否则保持第一列不变
3. **只执行用户要求的操作**：不要自作主张修改用户没有提到的内容

**允许的操作：**
- 修改特定单元格内容（用户指定位置）
- 批量替换某列的内容
- 排序（按某列升序/降序，但保持每行的完整性）
- 筛选/删除行（用户明确要求时）
- 添加新行（用户明确要求时）

请以JSON格式返回结果：
{
  "tableData": {
    "headers": ["..."],
    "rows": [["...", "...", ...], ...]
  },
  "explanation": "简短说明执行了什么操作"
}`;

        const result = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: instruction },
          ],
        });

        const responseContent = result.choices[0]?.message?.content;
        if (!responseContent || typeof responseContent !== 'string') {
          throw new Error("Failed to get response from LLM");
        }

        try {
          const parsed = parseJsonResponse<{
            tableData: TableData;
            explanation?: string;
          }>(responseContent);

          // Ensure each row has correct number of columns based on headers
          const expectedCols = parsed.tableData.headers.length;
          parsed.tableData.rows = parsed.tableData.rows.map((row, idx) => {
            const originalRow = tableData.rows[idx] || [];
            if (row.length < expectedCols) {
              const padded = [...row];
              for (let i = row.length; i < expectedCols; i++) {
                padded.push(originalRow[i] || '');
              }
              return padded;
            } else if (row.length > expectedCols) {
              return row.slice(0, expectedCols);
            }
            return row;
          });

          return {
            tableData: parsed.tableData,
            explanation: parsed.explanation,
          };
        } catch (e) {
          console.error("Failed to parse LLM response:", e);
          return {
            tableData,
            explanation: "处理失败，请重试",
          };
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
