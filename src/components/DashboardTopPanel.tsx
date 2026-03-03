import { useState } from 'react';
import { Card, Row, Col, Form, Input, Button, List, Tag, Space, Typography } from 'antd';
import { PlusOutlined, CheckCircleTwoTone, CloudOutlined, ClockCircleOutlined, DeleteOutlined } from '@ant-design/icons';

interface TodoItem {
  id: string;
  text: string;
  done: boolean;
}

const initialTodos: TodoItem[] = [
  { id: '1', text: '梳理今天要咨询的问题', done: false },
  { id: '2', text: '上传文档，让 AI 帮忙总结', done: false },
];

const DashboardTopPanel = () => {
  const [todos, setTodos] = useState<TodoItem[]>(initialTodos);
  const [form] = Form.useForm();

  const handleAdd = (values: { todo: string }) => {
    const text = values.todo?.trim();
    if (!text) return;
    setTodos((prev) => [
      { id: `${Date.now()}`, text, done: false },
      ...prev,
    ]);
    form.resetFields();
  };

  const toggleDone = (id: string) => {
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  };

  const handleDelete = (id: string) => {
    setTodos((prev) => prev.filter((t) => t.id !== id));
    
  };

  const remainingCount = todos.filter((t) => !t.done).length;
  const now = new Date();
  const dateText = now.toLocaleDateString('zh-CN', { weekday: 'long', month: 'short', day: 'numeric' });
  const timeText = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="top-panel-inner">
      <Row gutter={16}>
        <Col span={16}>
          <Card
            size="small"
            title="今日待办"
            extra={<Tag color={remainingCount ? 'blue' : 'green'}>{remainingCount ? `${remainingCount} 个未完成` : '全部完成'}</Tag>}
          >
            <Form form={form} layout="inline" onFinish={handleAdd} style={{ marginBottom: 12 }}>
              <Form.Item name="todo" style={{ flex: 1, marginRight: 8 }}>
                <Input placeholder="添加一条待办，例如：整理会议纪要" allowClear />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>
                  添加
                </Button>
              </Form.Item>
            </Form>
            <List
              size="small"
              locale={{ emptyText: '暂无待办，可以先添加一条~' }}
              dataSource={todos}
              renderItem={(item) => (
                <List.Item
                  style={{ opacity: item.done ? 0.6 : 1 }}
                  actions={[
                    <Button
                      key="delete"
                      type="text"
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(item.id);
                      }}
                    />,
                  ]}
                  onClick={() => toggleDone(item.id)}
                >
                  <Space>
                    <CheckCircleTwoTone twoToneColor={item.done ? '#52c41a' : '#d9d9d9'} />
                    <span style={{ textDecoration: item.done ? 'line-through' : 'none' }}>{item.text}</span>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" title="今日天气 / 小组件">
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Space>
                <CloudOutlined style={{ fontSize: 20, color: '#1677ff' }} />
                <Typography.Text strong>晴 · 26℃ · 上海</Typography.Text>
              </Space>
              <Space>
                <ClockCircleOutlined />
                <Typography.Text type="secondary">
                  {dateText} · {timeText}
                </Typography.Text>
              </Space>
              <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
                天气数据为示例展示，可在接入真实天气 API 后替换。
              </Typography.Paragraph>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DashboardTopPanel;
