import React, { useEffect, useState } from 'react';
import { motion, useSpring } from 'framer-motion';

const CustomCursor = () => {
 const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
 const [isPC, setIsPC] = useState(true);

 useEffect(() => {
 // Check if device is PC
 const checkDevice = () => {
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
  setIsPC(!isMobile);
 };
 
 checkDevice();
 window.addEventListener('resize', checkDevice);

 const updateMousePosition = (e) => {
  setMousePosition({ x: e.clientX, y: e.clientY });
 };

 window.addEventListener('mousemove', updateMousePosition);

 return () => {
  window.removeEventListener('mousemove', updateMousePosition);
  window.removeEventListener('resize', checkDevice);
 };
 }, []);

 // Spring physics for the 3 dots
 const springConfig1 = { damping: 25, stiffness: 300, mass: 0.5 };
 const springConfig2 = { damping: 25, stiffness: 200, mass: 0.8 };
 const springConfig3 = { damping: 25, stiffness: 150, mass: 1.2 };

 const cursorX1 = useSpring(mousePosition.x, springConfig1);
 const cursorY1 = useSpring(mousePosition.y, springConfig1);
 
 const cursorX2 = useSpring(mousePosition.x, springConfig2);
 const cursorY2 = useSpring(mousePosition.y, springConfig2);
 
 const cursorX3 = useSpring(mousePosition.x, springConfig3);
 const cursorY3 = useSpring(mousePosition.y, springConfig3);

 useEffect(() => {
 cursorX1.set(mousePosition.x - 4);
 cursorY1.set(mousePosition.y - 4);
 
 cursorX2.set(mousePosition.x - 4);
 cursorY2.set(mousePosition.y - 4);
 
 cursorX3.set(mousePosition.x - 4);
 cursorY3.set(mousePosition.y - 4);
 }, [mousePosition, cursorX1, cursorY1, cursorX2, cursorY2, cursorX3, cursorY3]);

 if (!isPC) return null;

 const dotClass = "fixed top-0 left-0 w-2 h-2 rounded-full bg-[#3300FF] pointer-events-none z-[9999] shadow-[0_0_15px_rgba(51,0,255,0.5)] mix-blend-multiply";

 return (
 <>
  <motion.div
  className={dotClass}
  style={{ x: cursorX1, y: cursorY1 }}
  />
  <motion.div
  className={`${dotClass} opacity-70 scale-75`}
  style={{ x: cursorX2, y: cursorY2 }}
  />
  <motion.div
  className={`${dotClass} opacity-40 scale-50`}
  style={{ x: cursorX3, y: cursorY3 }}
  />
 </>
 );
};

export default CustomCursor;
