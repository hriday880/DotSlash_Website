import React, { useState } from 'react';
import Footer from '../components/Footer';

// Icons — keeping original SVG paths
const EmailIcon = () => (
 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
 <path d="M12 12.713l11.985-8.713h-23.97l11.985 8.713zm0 2.574l-12-8.725v11.438h24v-11.438l-12 8.725z"/>
 </svg>
);

const WhatsAppIcon = () => (
 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
 <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.274.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.099.824zm-3.423-14.416c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm.029 18.88c-1.161 0-2.305-.292-3.318-.844l-3.677.964.984-3.595c-.607-1.052-.927-2.246-.926-3.468.001-3.825 3.113-6.937 6.937-6.937 3.825 0 6.938 3.112 6.938 6.937 0 3.825-3.113 6.938-6.938 6.938z"/>
 </svg>
);

const InstagramIcon = () => (
 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
 <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
 </svg>
);

const LinkedInIcon = () => (
 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
 <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
 </svg>
);

const GitHubIcon = () => (
 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
 <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
 </svg>
);

const contactChannels = [
 { name: "Email", value: "dotslash@flame.edu.in", icon: <EmailIcon />, link: "mailto:dotslash@flame.edu.in" },
 { name: "WhatsApp", value: "Join the community", icon: <WhatsAppIcon />, link: "https://chat.whatsapp.com/C3xNBybXypjDVnbAmbW2C1" },
 { name: "Instagram", value: "@dotslashflame", icon: <InstagramIcon />, link: "https://www.instagram.com/dotslashflame" },
 { name: "LinkedIn", value: "Connect professionally", icon: <LinkedInIcon />, link: "https://www.linkedin.com/company/dotslash-flame/?viewAsMember=true" },
 { name: "GitHub", value: "View our repositories", icon: <GitHubIcon />, link: "https://github.com/dotslash-flame" },
];

export default function Contact() {
 const [result, setResult] = useState("");

 const onSubmit = async (event) => {
 event.preventDefault();
 setResult("Sending...");
 const formData = new FormData(event.target);

 const response = await fetch("https://api.web3forms.com/submit", {
  method: "POST",
  body: formData
 });

 const data = await response.json();

 if (data.success) {
  setResult("Message Sent");
  event.target.reset();
 } else {
  console.log("Error", data);
  setResult(data.message);
 }
 };

 return (
 <div className="min-h-screen flex flex-col pt-32 pb-0 bg-[#F3F4F6] ">
  <div className="noise-overlay"></div>

  <main className="flex-grow px-margin-mobile md:px-margin-desktop w-full max-w-7xl mx-auto flex flex-col justify-center overflow-x-hidden">
  <header className="mb-24 w-full text-center flex flex-col items-center">
   <h1
   className="font-headline-display text-[32px] leading-[40px] sm:text-[50px] sm:leading-[60px] md:text-[80px] lg:text-headline-display lg:leading-[110px] text-[#3300FF] mb-8 uppercase break-words max-w-full "
   
   >
   Initialize Connection
   </h1>
   <p className="font-body-lg text-body-lg text-[#52525B] max-w-2xl">
   Open a secure channel with our operations team. We evaluate inquiries based on technical merit, architectural ambition, and strategic alignment.
   </p>
  </header>

  {/* Connection Links — Simple Grid (no carousel spin) */}
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-24">
   {contactChannels.map((channel, index) => (
   <a
    key={index}
    href={channel.link}
    target={channel.link.startsWith('mailto') ? undefined : '_blank'}
    rel="noopener noreferrer"
    className="glass-panel p-6 border border-[#E4E4E7] hover:border-[#3300FF] transition-all duration-300 group flex flex-col items-center gap-4 text-center hover:"
   >
    <div className="w-16 h-16 rounded-none bg-[#F4F4F5] flex items-center justify-center text-[#3300FF] group-hover:text-[#00D4FF] group-hover:bg-[#3300FF]/10 transition-colors duration-300 rounded-2xl border border-[#E4E4E7] shadow-sm hover:shadow-md">
    {channel.icon}
    </div>
    <div>
    <p className="font-sans text-xs tracking-widest uppercase font-semibold text-label-mono text-[#030303] group-hover:text-[#3300FF] transition-colors">{channel.name}</p>
    <p className="font-mono text-xs text-[#52525B] mt-1 break-all">{channel.value}</p>
    </div>
   </a>
   ))}
  </div>

  {/* Direct Messaging Form */}
  <div className="w-full max-w-2xl mx-auto mb-16 px-4">
   <h2 className="font-sans text-xs tracking-widest uppercase font-semibold text-label-caps text-[#3300FF] uppercase text-center mb-12">Direct Messaging</h2>
   <form onSubmit={onSubmit} className="glass-panel p-8 md:p-12 flex flex-col gap-8 w-full border border-[#E4E4E7]">
   <input type="hidden" name="access_key" value="ca90d616-5818-4454-a1bd-7b6054d300e8" />
   <input type="checkbox" name="botcheck" className="hidden" style={{ display: 'none' }} />

   <div className="flex flex-col gap-2">
    <label htmlFor="name" className="font-sans text-xs tracking-widest uppercase font-semibold text-label-mono text-[#030303] uppercase">Name</label>
    <input type="text" id="name" name="name" required className="bg-[#F4F4F5] border border-[#E4E4E7] text-[#030303] px-4 py-3 font-mono text-body-md focus:outline-none focus:border-[#3300FF] transition-colors" />
   </div>

   <div className="flex flex-col gap-2">
    <label htmlFor="email" className="font-sans text-xs tracking-widest uppercase font-semibold text-label-mono text-[#030303] uppercase">Email</label>
    <input type="email" id="email" name="email" required className="bg-[#F4F4F5] border border-[#E4E4E7] text-[#030303] px-4 py-3 font-mono text-body-md focus:outline-none focus:border-[#3300FF] transition-colors" />
   </div>

   <div className="flex flex-col gap-2">
    <label htmlFor="message" className="font-sans text-xs tracking-widest uppercase font-semibold text-label-mono text-[#030303] uppercase">Message</label>
    <textarea id="message" name="message" rows="5" required className="bg-[#F4F4F5] border border-[#E4E4E7] text-[#030303] px-4 py-3 font-mono text-body-md focus:outline-none focus:border-[#3300FF] transition-colors resize-none"></textarea>
   </div>

   <div className="flex flex-col gap-2 mt-4">
    <button type="submit" className="cyber-button self-start group">
    Send Message
    <svg className="arrow w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
     <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
    </svg>
    </button>
    {result && <span className="text-[#3300FF] font-mono text-body-md mt-2">{result}</span>}
   </div>
   </form>
  </div>
  </main>

  <footer className="bg-[#F3F4F6] border-t border-[#E4E4E7] w-full grid grid-cols-12 gap-gutter px-margin-mobile md:px-margin-desktop py-8 md:py-section-gap relative z-20 mt-32">
  <div className="col-span-12 md:col-span-6 flex flex-col justify-between">
   <div className="font-headline-lg text-headline-lg font-black text-[#030303] mb-8">DotSlash</div>
   <p className="font-sans text-xs tracking-widest uppercase font-semibold text-label-mono text-[#636565]">© 2024 DotSlash. ALL RIGHTS RESERVED. ENGINEERED FOR EXCELLENCE.</p>
  </div>
  <div className="col-span-12 md:col-span-6 flex justify-end items-end gap-8">
  </div>
  </footer>
 </div>
 );
}
