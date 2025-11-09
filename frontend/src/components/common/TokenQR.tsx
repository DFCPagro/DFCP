import { QRCodeCanvas } from "qrcode.react";

const TokenQR = ({ token, size = 200, margin = 0}) => {
  return (
    <div style={{ textAlign: "center" }}>
      {/* <h3>Your Token QR Code</h3> */}
      <QRCodeCanvas
        value={token}               // The token you want to encode
        size={size}                 // Optional size (default: 200)
        bgColor="#ffffff"           // Background color
        fgColor="#000000"           // Foreground color
        level="H"                   // Error correction level: L, M, Q, H
        marginSize={margin}    // Enables margin if margin > 0
      />
      {/* <p>{token}</p> */}
    </div>
  );
};

export default TokenQR;
