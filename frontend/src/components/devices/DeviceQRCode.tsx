
import QRCode from "react-qr-code";
interface Props {
    device:any
    size?: number
}

export default function DeviceQRCode({device}:Props){

    if(!device.qr_token){
        return <span className="text-red-500">
            Thiếu QR token
        </span>
    }

    return (
        <div className="flex flex-col items-center gap-3">
            <div className="border rounded bg-white p-2"><QRCode size={160} value={`${window.location.origin}/qr/${device.qr_token}`} /></div>

            <div className="text-center">
                <p className="font-semibold">
                    {device.device_code}
                </p>
                <p className="text-sm">
                    {device.name}
                </p>
            </div>
        </div>
    )
}
