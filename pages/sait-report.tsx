import Head from "next/head";
import styles from "../styles/SaitReport.module.css";

export default function SaitReport() {
  return (
    <div className={styles.container}>
      <Head>
        <title>SAIT Report</title>
        <meta name="description" content="SAIT Sustainability Report PDF" />
      </Head>
      <h1>SAIT Sustainability Report</h1>
      <iframe
        src="/SAIT_REPORT.pdf"
        width="100%"
        height="800px"
        title="SAIT Report PDF"
        className={styles.pdfViewer}
      />
      <a href="/SAIT_REPORT.pdf" download className={styles.downloadButton}>
        Download PDF
      </a>
    </div>
  );
}
