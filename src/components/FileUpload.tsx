import { useRef } from "react";
import { useFileStore } from "../store/fileStore";
import { uploadFile } from "../services/fileUploadService";
import styles from "./FileUpload.module.css";
import { Dropdown, Button, Tooltip } from "antd";
import type { MenuProps } from "antd";
import { PlusOutlined, FileTextOutlined, PictureOutlined } from "@ant-design/icons";

const FileUpload = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const { files, clearFile } = useFileStore();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      Array.from(e.target.files).forEach(file => {
        console.log(`[FileUpload] 选择文件: ${file.name} (${file.size} bytes)`);
        // 调用上传函数并捕获错误
        uploadFile(file).catch(err => {
          console.error(`[FileUpload] 上传失败:`, err);
          // 可在这里添加用户提示（如alert或UI提示）
        });
      });
    }
    // 重置输入框，允许重复选择同一文件
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  };

  const menuItems: MenuProps["items"] = [
    {
      key: "doc",
      icon: <FileTextOutlined />,
      label: "上传文档（PDF/Word）",
    },
    {
      key: "img",
      icon: <PictureOutlined />,
      label: "上传图片",
    },
  ];

  const handleMenuClick: MenuProps["onClick"] = ({ key }) => {
    if (key === "doc") {
      fileInputRef.current?.click();
    } else if (key === "img") {
      imageInputRef.current?.click();
    }
  };

  return (
    <div className={styles.container}>
      <Dropdown
        menu={{ items: menuItems, onClick: handleMenuClick }}
        trigger={["click"]}
        placement="topLeft"
      >
        <Tooltip title="上传文档或图片">
          <Button
            type="primary"
            shape="circle"
            icon={<PlusOutlined />}
            className={styles.uploadBtn}
          />
        </Tooltip>
      </Dropdown>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        accept=".pdf,.doc,.docx"
        className={styles.fileInput}
        style={{ display: 'none' }} // 隐藏原生输入框
      />
      <input
        ref={imageInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleFileSelect}
        className={styles.fileInput}
        style={{ display: 'none' }}
      />

      {/* 上传列表 */}
      <div className={styles.fileList}>
        {files.map(file => (
          <div key={file.id} className={styles.fileItem}>
            <div className={styles.fileInfo}>
              <span>{file.name}</span>
              <span className={styles.size}>
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </span>
            </div>
            <div className={styles.progressContainer}>
              <progress 
                value={file.totalProgress} 
                max={100} 
                className={styles.progressBar}
              />
              <span className={styles.progressText}>
                {file.totalProgress}%
              </span>
            </div>
            <div className={styles.status}>
              状态: {file.status}
              {file.status === "completed" || (
                <button 
                  onClick={() => clearFile(file.fileId)}
                  className={styles.clearBtn}
                >
                  移除
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FileUpload;