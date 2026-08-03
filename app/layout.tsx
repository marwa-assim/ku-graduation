import "./globals.css";
import type {Metadata,Viewport} from "next";
import {GlobalSeatTooltip} from "@/components/GlobalSeatTooltip";
import {ResponsiveTables} from "@/components/ResponsiveTables";
export const metadata:Metadata={title:"KU Events Management",description:"Kingdom University events and graduation management platform",applicationName:"KU Events",manifest:"/manifest.webmanifest",appleWebApp:{capable:true,statusBarStyle:"black-translucent",title:"KU Events"},formatDetection:{telephone:false}};
export const viewport:Viewport={width:"device-width",initialScale:1,maximumScale:1,viewportFit:"cover",themeColor:"#101724"};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body><GlobalSeatTooltip/><ResponsiveTables/>{children}</body></html>}
