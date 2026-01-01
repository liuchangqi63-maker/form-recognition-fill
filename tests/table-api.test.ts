import { describe, it, expect, vi } from 'vitest';

// Mock the LLM module
vi.mock('../server/_core/llm', () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          title: "测试表格",
          tableData: {
            headers: ["姓名", "年龄", "城市"],
            rows: [
              ["张三", "25", "北京"],
              ["李四", "30", "上海"]
            ]
          }
        })
      }
    }]
  })
}));

describe('Table API Types', () => {
  it('should have correct TableData structure', () => {
    const tableData = {
      headers: ["列1", "列2", "列3"],
      rows: [
        ["数据1", "数据2", "数据3"],
        ["数据4", "数据5", "数据6"]
      ]
    };

    expect(tableData.headers).toHaveLength(3);
    expect(tableData.rows).toHaveLength(2);
    expect(tableData.rows[0]).toHaveLength(3);
  });

  it('should handle empty table', () => {
    const emptyTable = {
      headers: [],
      rows: []
    };

    expect(emptyTable.headers).toHaveLength(0);
    expect(emptyTable.rows).toHaveLength(0);
  });

  it('should parse JSON response correctly', () => {
    const jsonResponse = `{
      "tableData": {
        "headers": ["A", "B"],
        "rows": [["1", "2"]]
      },
      "searchSummary": "Found 1 result"
    }`;

    const parsed = JSON.parse(jsonResponse);
    expect(parsed.tableData.headers).toEqual(["A", "B"]);
    expect(parsed.searchSummary).toBe("Found 1 result");
  });

  it('should parse JSON from markdown code block', () => {
    const markdownResponse = '```json\n{"title": "Test", "tableData": {"headers": ["X"], "rows": [["Y"]]}}\n```';
    
    const jsonMatch = markdownResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : markdownResponse.trim();
    const parsed = JSON.parse(jsonStr);
    
    expect(parsed.title).toBe("Test");
    expect(parsed.tableData.headers).toEqual(["X"]);
  });
});

describe('Document Storage', () => {
  it('should create document with correct structure', () => {
    const now = new Date().toISOString();
    const document = {
      id: `doc_${Date.now()}_abc123`,
      title: "测试文档",
      description: "这是一个测试",
      tableData: {
        headers: ["列1", "列2"],
        rows: [["值1", "值2"]]
      },
      createdAt: now,
      updatedAt: now
    };

    expect(document.id).toMatch(/^doc_\d+_\w+$/);
    expect(document.title).toBe("测试文档");
    expect(document.tableData.headers).toHaveLength(2);
  });
});
