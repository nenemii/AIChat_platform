import React, { useState, useRef } from 'react';
import { useChatStore } from '../store/chatStore';
import styles from './FileUpload.module.css';

// 定义文件上传状态类型
type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

const FileUpload: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [errorMsg, setErrorMsg] = useState(''); // 新增：具体错误信息
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMessage = useChatStore(state => state.addMessage);
  const isLoading = useChatStore(state => state.isLoading); // 关联全局加载状态

  // 触发文件选择弹窗
  const handleSelectFile = () => {
    if (isLoading) return; // AI处理中禁止上传
    fileInputRef.current?.click();
  };

  // 处理文件选择
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // 简单校验文件大小（例如限制10MB以内）
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (selectedFile.size > maxSize) {
        setErrorMsg('文件大小不能超过10MB');
        setStatus('error');
        setTimeout(() => setStatus('idle'), 3000);
        return;
      }
      setFile(selectedFile);
      setStatus('idle');
      setProgress(0);
      setErrorMsg('');
      handleUpload(selectedFile); // 选择后自动上传
    }
  };

  // 处理文件上传（对接后端接口）
  const handleUpload = (file: File) => {
    setStatus('uploading');
    setProgress(0);

    const formData = new FormData();
    formData.append('file', file);

    // 注意：后端地址要和AI接口一致（这里用你后端的地址）
    const uploadUrl = 'http://localhost:3001/api/upload';

    const xhr = new XMLHttpRequest();
    xhr.open('POST', uploadUrl, true);

    // 监听进度
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        setProgress(percent);
      }
    });

    // 上传完成
    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        try {
          // 假设后端返回文件信息（例如：{ fileId: 'xxx', fileName: 'xxx' }）
          const response = JSON.parse(xhr.responseText);
          setStatus('success');
          // 上传成功后添加到消息列表（补充status字段，符合Message类型）
          const fileInfo = `上传了文件：${response.fileName || file.name}（${formatFileSize(file.size)}）`;
          addMessage({
            role: 'user',
            content: fileInfo,
            status: 'complete' // 关键：补充status，适配Message类型
          });
          // 3秒后重置状态
          setTimeout(() => {
            setFile(null);
            setStatus('idle');
          }, 3000);
        } catch (err) {
          setErrorMsg('文件上传成功，但解析响应失败');
          setStatus('error');
        }
      } else {
        setErrorMsg(`上传失败：${xhr.statusText || '服务器错误'}`);
        setStatus('error');
      }
    });

    // 网络错误
    xhr.addEventListener('error', () => {
      setErrorMsg('网络错误，无法连接服务器');
      setStatus('error');
    });

    xhr.send(formData);
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // 渲染不同状态的UI
  const renderStatusUI = () => {
    switch (status) {
      case 'idle':
        return file ? <span className={styles.fileName}>{file.name}</span> : '添加文件';
      case 'uploading':
        return (
          <div className={styles.progressContainer}>
            <span>上传中：{progress}%</span>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${progress}%` }} />
            </div>
          </div>
        );
      case 'success':
        return <span className={styles.success}>✓ 上传成功</span>;
      case 'error':
        return <span className={styles.error}>{errorMsg || '✗ 上传失败，请重试'}</span>;
      default:
        return null;
    }
  };

  return (
    <div className={styles.container}>
      {/* 隐藏的文件选择器 */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className={styles.fileInput}
        multiple={false}
        accept=".pdf,.doc,.docx,.txt,.jpg,.png" // 限制常见文件类型
        disabled={isLoading} // AI处理中禁用选择
      />
      {/* 可见的触发按钮 */}
      <button
        className={styles.uploadButton}
        onClick={handleSelectFile}
        disabled={status === 'uploading' || isLoading} // 上传中或AI处理中禁用
      >
        {renderStatusUI()}
      </button>
    </div>
  );
};

export default FileUpload;