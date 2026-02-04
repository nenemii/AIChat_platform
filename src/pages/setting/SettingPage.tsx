import React from "react";
import styles from './SettingPage.module.css';
import ThemeToggle from "../../components/ThemeToggle";
import { Card, Typography, Space } from 'antd';

const SettingPage = () => {
  return (
    <div className={styles.container}>
      <Card title="设置" className={styles.card}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div className={styles.themeRow}>
            <Typography.Text>主题模式</Typography.Text>
            <div className={styles.themeToggle}>
              <ThemeToggle />
            </div>
          </div>
        </Space>
      </Card>
    </div>
  );
};

export default SettingPage;