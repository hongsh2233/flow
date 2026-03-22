import QRCode from "qrcode";
import styles from "./PcAccessBlockedScreen.module.css";

type Props = {
  siteUrl: string;
};

export default async function PcAccessBlockedScreen({ siteUrl }: Props) {
  let qrDataUrl = "";
  if (siteUrl) {
    try {
      qrDataUrl = await QRCode.toDataURL(siteUrl, {
        width: 220,
        margin: 2,
        color: { dark: "#0f172a", light: "#ffffff" },
      });
    } catch {
      qrDataUrl = "";
    }
  }

  return (
    <div className={styles.root}>
      <h1 className={styles.title}>모바일에서 이용 가능한 서비스입니다</h1>
      <p className={styles.sub}>
        플로우는 스마트폰 환경에 맞춰 제공됩니다. 아래 QR 코드를 스캔하거나 주소를 모바일
        브라우저에 입력해 주세요.
      </p>
      {qrDataUrl ? (
        <div className={styles.qrWrap}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={styles.qr}
            src={qrDataUrl}
            width={220}
            height={220}
            alt="모바일 접속용 QR 코드"
          />
        </div>
      ) : null}
      {siteUrl ? <p className={styles.urlBox}>{siteUrl}</p> : null}
      <p className={styles.hint}>PC에서는 이용할 수 없습니다.</p>
    </div>
  );
}
