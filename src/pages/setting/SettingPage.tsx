import React from "react";
import styles from './SettingPage.module.css'
import ThemeToggle from "../../components/ThemeToggle";

const SettingPage = ()=>{
  return (
    <div>
      <div className={styles.themeToggle}>
        <ThemeToggle/>
      </div>
      
    </div>
  )
}



export default SettingPage