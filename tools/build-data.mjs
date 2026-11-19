// Builds data/transit.json from the compact tables below.
// Run: node tools/build-data.mjs
// Not part of the deployed site.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHECKED_ON = '2026-11-10';

// ---------------------------------------------------------------------------
// Lines. minutesPerStop = average running time between adjacent stations
// (including dwell). waitMinutes = average wait when boarding (about half
// the typical daytime headway). Colours are the official line colours.
// ---------------------------------------------------------------------------
const lines = [
  { id: 'sukhumvit', short: 'BTS', name_en: 'BTS Sukhumvit Line', name_th: 'รถไฟฟ้าบีทีเอส สายสุขุมวิท', color: '#7AC143', text: '#0B2545', operator: 'BTS', fareSystem: 'bts', minutesPerStop: 2.0, waitMinutes: 3 },
  { id: 'silom', short: 'BTS', name_en: 'BTS Silom Line', name_th: 'รถไฟฟ้าบีทีเอส สายสีลม', color: '#007A33', text: '#FFFFFF', operator: 'BTS', fareSystem: 'bts', minutesPerStop: 2.0, waitMinutes: 3 },
  { id: 'gold', short: 'BTS', name_en: 'BTS Gold Line', name_th: 'รถไฟฟ้าสายสีทอง', color: '#C9A227', text: '#0B2545', operator: 'Krungthep Thanakom', fareSystem: 'gold', minutesPerStop: 2.0, waitMinutes: 4 },
  { id: 'blue', short: 'MRT', name_en: 'MRT Blue Line', name_th: 'รถไฟฟ้ามหานคร สายสีน้ำเงิน', color: '#1E4F9C', text: '#FFFFFF', operator: 'BEM', fareSystem: 'mrt', minutesPerStop: 2.0, waitMinutes: 3 },
  { id: 'purple', short: 'MRT', name_en: 'MRT Purple Line', name_th: 'รถไฟฟ้ามหานคร สายสีม่วง', color: '#7B3F98', text: '#FFFFFF', operator: 'BEM', fareSystem: 'mrt', minutesPerStop: 2.5, waitMinutes: 4 },
  { id: 'yellow', short: 'MRT', name_en: 'MRT Yellow Line', name_th: 'รถไฟฟ้าสายสีเหลือง', color: '#F5D000', text: '#0B2545', operator: 'Eastern Bangkok Monorail', fareSystem: 'yellow', minutesPerStop: 2.3, waitMinutes: 4 },
  { id: 'pink', short: 'MRT', name_en: 'MRT Pink Line', name_th: 'รถไฟฟ้าสายสีชมพู', color: '#E4569A', text: '#FFFFFF', operator: 'Northern Bangkok Monorail', fareSystem: 'pink', minutesPerStop: 2.3, waitMinutes: 4 },
  { id: 'arl', short: 'ARL', name_en: 'Airport Rail Link', name_th: 'รถไฟฟ้าเชื่อมท่าอากาศยานสุวรรณภูมิ', color: '#8E1B2E', text: '#FFFFFF', operator: 'Asia Era One', fareSystem: 'arl', minutesPerStop: 3.6, waitMinutes: 6 },
  { id: 'red', short: 'SRT', name_en: 'SRT Dark Red Line', name_th: 'รถไฟชานเมืองสายสีแดงเข้ม', color: '#D6001C', text: '#FFFFFF', operator: 'SRTET', fareSystem: 'srt', minutesPerStop: 2.8, waitMinutes: 7 },
  { id: 'red-light', short: 'SRT', name_en: 'SRT Light Red Line', name_th: 'รถไฟชานเมืองสายสีแดงอ่อน', color: '#F2827F', text: '#0B2545', operator: 'SRTET', fareSystem: 'srt', minutesPerStop: 4.5, waitMinutes: 10 },
];

// ---------------------------------------------------------------------------
// Stations per line, in running order: [code, English, Thai, lat, lng]
// Coordinates are approximate platform locations (WGS84).
// ---------------------------------------------------------------------------
const S = {
  sukhumvit: [
    ['N24', 'Khu Khot', 'คูคต', 13.9318, 100.6469],
    ['N23', 'Yaek Kor Por Aor', 'แยก คปอ.', 13.9241, 100.6265],
    ['N22', 'Royal Thai Air Force Museum', 'พิพิธภัณฑ์กองทัพอากาศ', 13.9178, 100.6214],
    ['N21', 'Bhumibol Adulyadej Hospital', 'โรงพยาบาลภูมิพลอดุลยเดช', 13.9107, 100.6176],
    ['N20', 'Saphan Mai', 'สะพานใหม่', 13.8961, 100.6104],
    ['N19', 'Sai Yud', 'สายหยุด', 13.8883, 100.6058],
    ['N18', 'Phahon Yothin 59', 'พหลโยธิน 59', 13.8822, 100.6021],
    ['N17', 'Wat Phra Sri Mahathat', 'วัดพระศรีมหาธาตุ', 13.8753, 100.5967],
    ['N16', '11th Infantry Regiment', 'กรมทหารราบที่ 11', 13.8676, 100.5918],
    ['N15', 'Bang Bua', 'บางบัว', 13.8566, 100.5850],
    ['N14', 'Royal Forest Department', 'กรมป่าไม้', 13.8497, 100.5807],
    ['N13', 'Kasetsart University', 'มหาวิทยาลัยเกษตรศาสตร์', 13.8420, 100.5760],
    ['N12', 'Sena Nikhom', 'เสนานิคม', 13.8364, 100.5727],
    ['N11', 'Ratchayothin', 'รัชโยธิน', 13.8296, 100.5690],
    ['N10', 'Phahon Yothin 24', 'พหลโยธิน 24', 13.8237, 100.5650],
    ['N9', 'Ha Yaek Lat Phrao', 'ห้าแยกลาดพร้าว', 13.8166, 100.5618],
    ['N8', 'Mo Chit', 'หมอชิต', 13.8026, 100.5537],
    ['N7', 'Saphan Khwai', 'สะพานควาย', 13.7937, 100.5498],
    ['N5', 'Ari', 'อารีย์', 13.77971, 100.54462],
    ['N4', 'Sanam Pao', 'สนามเป้า', 13.77262, 100.54207],
    ['N3', 'Victory Monument', 'อนุสาวรีย์ชัยสมรภูมิ', 13.7627, 100.5372],
    ['N2', 'Phaya Thai', 'พญาไท', 13.75696, 100.53382],
    ['N1', 'Ratchathewi', 'ราชเทวี', 13.75186, 100.53155],
    ['CEN', 'Siam', 'สยาม', 13.74562, 100.53422],
    ['E1', 'Chit Lom', 'ชิดลม', 13.7442, 100.5430],
    ['E2', 'Phloen Chit', 'เพลินจิต', 13.74307, 100.54898],
    ['E3', 'Nana', 'นานา', 13.7405, 100.5552],
    ['E4', 'Asok', 'อโศก', 13.73704, 100.56036],
    ['E5', 'Phrom Phong', 'พร้อมพงษ์', 13.73043, 100.56971],
    ['E6', 'Thong Lo', 'ทองหล่อ', 13.72423, 100.57851],
    ['E7', 'Ekkamai', 'เอกมัย', 13.71954, 100.58511],
    ['E8', 'Phra Khanong', 'พระโขนง', 13.71517, 100.59124],
    ['E9', 'On Nut', 'อ่อนนุช', 13.70562, 100.601],
    ['E10', 'Bang Chak', 'บางจาก', 13.69676, 100.60534],
    ['E11', 'Punnawithi', 'ปุณณวิถี', 13.6893, 100.6089],
    ['E12', 'Udom Suk', 'อุดมสุข', 13.67987, 100.60947],
    ['E13', 'Bang Na', 'บางนา', 13.6681, 100.6044],
    ['E14', 'Bearing', 'แบริ่ง', 13.6610, 100.6013],
    ['E15', 'Samrong', 'สำโรง', 13.6464, 100.5958],
    ['E16', 'Pu Chao', 'ปู่เจ้า', 13.6375, 100.5925],
    ['E17', 'Chang Erawan', 'ช้างเอราวัณ', 13.6215, 100.5900],
    ['E18', 'Royal Thai Naval Academy', 'โรงเรียนนายเรือ', 13.6083, 100.5945],
    ['E19', 'Pak Nam', 'ปากน้ำ', 13.6043, 100.6056],
    ['E20', 'Srinagarindra', 'ศรีนครินทร์', 13.6017, 100.6152],
    ['E21', 'Phraek Sa', 'แพรกษา', 13.5985, 100.6247],
    ['E22', 'Sai Luat', 'สายลวด', 13.5955, 100.6335],
    ['E23', 'Kheha', 'เคหะฯ', 13.5924, 100.6450],
  ],
  silom: [
    ['W1', 'National Stadium', 'สนามกีฬาแห่งชาติ', 13.74651, 100.52909],
    ['CEN', 'Siam', 'สยาม', 13.74562, 100.53422],
    ['S1', 'Ratchadamri', 'ราชดำริ', 13.73947, 100.53945],
    ['S2', 'Sala Daeng', 'ศาลาแดง', 13.72857, 100.53434],
    ['S3', 'Chong Nonsi', 'ช่องนนทรี', 13.7238, 100.52933],
    ['S4', 'Saint Louis', 'เซนต์หลุยส์', 13.72082, 100.52669],
    ['S5', 'Surasak', 'สุรศักดิ์', 13.7194, 100.5216],
    ['S6', 'Saphan Taksin', 'สะพานตากสิน', 13.71881, 100.51422],
    ['S7', 'Krung Thon Buri', 'กรุงธนบุรี', 13.7209, 100.5028],
    ['S8', 'Wongwian Yai', 'วงเวียนใหญ่', 13.7212, 100.4955],
    ['S9', 'Pho Nimit', 'โพธิ์นิมิตร', 13.7194, 100.4860],
    ['S10', 'Talat Phlu', 'ตลาดพลู', 13.7140, 100.4766],
    ['S11', 'Wutthakat', 'วุฒากาศ', 13.7130, 100.4686],
    ['S12', 'Bang Wa', 'บางหว้า', 13.7206, 100.4577],
  ],
  gold: [
    ['G1', 'Krung Thon Buri', 'กรุงธนบุรี', 13.7213, 100.5034],
    ['G2', 'Charoen Nakhon', 'เจริญนคร', 13.7266, 100.5099],
    ['G3', 'Khlong San', 'คลองสาน', 13.73031, 100.50772],
  ],
  blue: [
    ['BL01', 'Tha Phra', 'ท่าพระ', 13.7302, 100.4740],
    ['BL02', 'Charan 13', 'จรัญฯ 13', 13.7393, 100.4708],
    ['BL03', 'Fai Chai', 'ไฟฉาย', 13.7487, 100.4728],
    ['BL04', 'Bang Khun Non', 'บางขุนนนท์', 13.7631, 100.4741],
    ['BL05', 'Bang Yi Khan', 'บางยี่ขัน', 13.7720, 100.4847],
    ['BL06', 'Sirindhorn', 'สิรินธร', 13.78387, 100.49333],
    ['BL07', 'Bang Phlat', 'บางพลัด', 13.7914, 100.5050],
    ['BL08', 'Bang O', 'บางอ้อ', 13.7987, 100.5098],
    ['BL09', 'Bang Pho', 'บางโพ', 13.8063, 100.5208],
    ['BL10', 'Tao Poon', 'เตาปูน', 13.8062, 100.5306],
    ['BL11', 'Bang Sue', 'บางซื่อ', 13.8027, 100.5384],
    ['BL12', 'Kamphaeng Phet', 'กำแพงเพชร', 13.79795, 100.54788],
    ['BL13', 'Chatuchak Park', 'สวนจตุจักร', 13.8028, 100.5536],
    ['BL14', 'Phahon Yothin', 'พหลโยธิน', 13.8129, 100.5610],
    ['BL15', 'Lat Phrao', 'ลาดพร้าว', 13.8063, 100.5730],
    ['BL16', 'Ratchadaphisek', 'รัชดาภิเษก', 13.7986, 100.5747],
    ['BL17', 'Sutthisan', 'สุทธิสาร', 13.7896, 100.5740],
    ['BL18', 'Huai Khwang', 'ห้วยขวาง', 13.7786, 100.5737],
    ['BL19', 'Thailand Cultural Centre', 'ศูนย์วัฒนธรรมแห่งประเทศไทย', 13.7660, 100.5703],
    ['BL20', 'Phra Ram 9', 'พระราม 9', 13.7576, 100.5653],
    ['BL21', 'Phetchaburi', 'เพชรบุรี', 13.7490, 100.5634],
    ['BL22', 'Sukhumvit', 'สุขุมวิท', 13.73739, 100.56134],
    ['BL23', 'Queen Sirikit National Convention Centre', 'ศูนย์การประชุมแห่งชาติสิริกิติ์', 13.72267, 100.55991],
    ['BL24', 'Khlong Toei', 'คลองเตย', 13.7223, 100.5537],
    ['BL25', 'Lumphini', 'ลุมพินี', 13.72561, 100.54572],
    ['BL26', 'Si Lom', 'สีลม', 13.7292, 100.53707],
    ['BL27', 'Sam Yan', 'สามย่าน', 13.7326, 100.5299],
    ['BL28', 'Hua Lamphong', 'หัวลำโพง', 13.73757, 100.51714],
    ['BL29', 'Wat Mangkon', 'วัดมังกร', 13.74221, 100.50991],
    ['BL30', 'Sam Yot', 'สามยอด', 13.747, 100.5023],
    ['BL31', 'Sanam Chai', 'สนามไชย', 13.74433, 100.49462],
    ['BL32', 'Itsaraphap', 'อิสรภาพ', 13.7386, 100.4859],
    ['BL33', 'Bang Phai', 'บางไผ่', 13.7247, 100.4614],
    ['BL34', 'Bang Wa', 'บางหว้า', 13.7206, 100.4577],
    ['BL35', 'Phetkasem 48', 'เพชรเกษม 48', 13.7160, 100.4442],
    ['BL36', 'Phasi Charoen', 'ภาษีเจริญ', 13.7128, 100.4347],
    ['BL37', 'Bang Khae', 'บางแค', 13.7117, 100.4227],
    ['BL38', 'Lak Song', 'หลักสอง', 13.7108, 100.4093],
  ],
  purple: [
    ['PP01', 'Khlong Bang Phai', 'คลองบางไผ่', 13.8925, 100.4093],
    ['PP02', 'Talad Bang Yai', 'ตลาดบางใหญ่', 13.8852, 100.4172],
    ['PP03', 'Sam Yaek Bang Yai', 'สามแยกบางใหญ่', 13.8778, 100.4240],
    ['PP04', 'Bang Phlu', 'บางพลู', 13.8724, 100.4330],
    ['PP05', 'Bang Rak Yai', 'บางรักใหญ่', 13.8705, 100.4450],
    ['PP06', 'Bang Rak Noi Tha It', 'บางรักน้อยท่าอิฐ', 13.8685, 100.4600],
    ['PP07', 'Sai Ma', 'ไทรม้า', 13.8661, 100.4734],
    ['PP08', 'Phra Nang Klao Bridge', 'สะพานพระนั่งเกล้า', 13.8630, 100.4858],
    ['PP09', 'Yaek Nonthaburi 1', 'แยกนนทบุรี 1', 13.8662, 100.4979],
    ['PP10', 'Bang Krasor', 'บางกระสอ', 13.8618, 100.5045],
    ['PP11', 'Nonthaburi Civic Center', 'ศูนย์ราชการนนทบุรี', 13.8580, 100.5132],
    ['PP12', 'Ministry of Public Health', 'กระทรวงสาธารณสุข', 13.8476, 100.5148],
    ['PP13', 'Yaek Tiwanon', 'แยกติวานนท์', 13.8432, 100.5135],
    ['PP14', 'Wong Sawang', 'วงศ์สว่าง', 13.8301, 100.5263],
    ['PP15', 'Bang Son', 'บางซ่อน', 13.8205, 100.5323],
    ['PP16', 'Tao Poon', 'เตาปูน', 13.8062, 100.5306],
  ],
  yellow: [
    ['YL01', 'Lat Phrao', 'ลาดพร้าว', 13.8068, 100.5745],
    ['YL02', 'Phawana', 'ภาวนา', 13.8023, 100.5868],
    ['YL03', 'Chok Chai 4', 'โชคชัย 4', 13.7979, 100.5954],
    ['YL04', 'Lat Phrao 71', 'ลาดพร้าว 71', 13.7934, 100.6044],
    ['YL05', 'Lat Phrao 83', 'ลาดพร้าว 83', 13.7893, 100.6127],
    ['YL06', 'Mahat Thai', 'มหาดไทย', 13.7863, 100.6218],
    ['YL07', 'Lat Phrao 101', 'ลาดพร้าว 101', 13.7841, 100.6316],
    ['YL08', 'Bang Kapi', 'บางกะปิ', 13.7684, 100.6425],
    ['YL09', 'Yaek Lam Sali', 'แยกลำสาลี', 13.7598, 100.6460],
    ['YL10', 'Si Kritha', 'ศรีกรีฑา', 13.7486, 100.6450],
    ['YL11', 'Hua Mak', 'หัวหมาก', 13.73615, 100.64114],
    ['YL12', 'Kalantan', 'กลันตัน', 13.7270, 100.6440],
    ['YL13', 'Si Nut', 'ศรีนุช', 13.7160, 100.6447],
    ['YL14', 'Srinagarindra 38', 'ศรีนครินทร์ 38', 13.7053, 100.6450],
    ['YL15', 'Suan Luang Rama IX', 'สวนหลวง ร.9', 13.6926, 100.6463],
    ['YL16', 'Si Udom', 'ศรีอุดม', 13.6810, 100.6476],
    ['YL17', 'Si Iam', 'ศรีเอี่ยม', 13.6688, 100.6460],
    ['YL18', 'Si La Salle', 'ศรีลาซาล', 13.6575, 100.6443],
    ['YL19', 'Si Bearing', 'ศรีแบริ่ง', 13.6457, 100.6419],
    ['YL20', 'Si Dan', 'ศรีด่าน', 13.6345, 100.6385],
    ['YL21', 'Si Thepha', 'ศรีเทพา', 13.6262, 100.6340],
    ['YL22', 'Thipphawan', 'ทิพวัล', 13.6352, 100.6157],
    ['YL23', 'Samrong', 'สำโรง', 13.6460, 100.5975],
  ],
  pink: [
    ['PK01', 'Nonthaburi Civic Center', 'ศูนย์ราชการนนทบุรี', 13.8590, 100.5150],
    ['PK02', 'Khae Rai', 'แคราย', 13.8614, 100.5214],
    ['PK03', 'Sanambin Nam', 'สนามบินน้ำ', 13.8715, 100.5190],
    ['PK04', 'Samakkhi', 'สามัคคี', 13.8800, 100.5170],
    ['PK05', 'Royal Irrigation Department', 'กรมชลประทาน', 13.8900, 100.5140],
    ['PK06', 'Yaek Pak Kret', 'แยกปากเกร็ด', 13.9085, 100.5130],
    ['PK07', 'Pak Kret Bypass', 'เลี่ยงเมืองปากเกร็ด', 13.9110, 100.5250],
    ['PK08', 'Chaeng Watthana-Pak Kret 28', 'แจ้งวัฒนะ-ปากเกร็ด 28', 13.9090, 100.5340],
    ['PK09', 'Si Rat', 'ศรีรัช', 13.9050, 100.5430],
    ['PK10', 'Muang Thong Thani', 'เมืองทองธานี', 13.9010, 100.5490],
    ['PK11', 'Chaeng Watthana 14', 'แจ้งวัฒนะ 14', 13.8950, 100.5570],
    ['PK12', 'Government Complex', 'ศูนย์ราชการเฉลิมพระเกียรติ', 13.8860, 100.5650],
    ['PK13', 'National Telecom', 'โทรคมนาคมแห่งชาติ', 13.8858, 100.5725],
    ['PK14', 'Lak Si', 'หลักสี่', 13.8866, 100.5805],
    ['PK15', 'Rajabhat Phranakhon', 'ราชภัฏพระนคร', 13.8790, 100.5900],
    ['PK16', 'Wat Phra Sri Mahathat', 'วัดพระศรีมหาธาตุ', 13.8757, 100.5975],
    ['PK17', 'Ram Inthra 3', 'รามอินทรา 3', 13.8720, 100.6060],
    ['PK18', 'Lat Pla Khao', 'ลาดปลาเค้า', 13.8680, 100.6150],
    ['PK19', 'Ram Inthra Kor Mor 4', 'รามอินทรา กม.4', 13.8645, 100.6230],
    ['PK20', 'Maiyalap', 'มัยลาภ', 13.8600, 100.6340],
    ['PK21', 'Vacharaphol', 'วัชรพล', 13.8560, 100.6440],
    ['PK22', 'Ram Inthra Kor Mor 6', 'รามอินทรา กม.6', 13.8515, 100.6540],
    ['PK23', 'Khu Bon', 'คู้บอน', 13.8470, 100.6640],
    ['PK24', 'Ram Inthra Kor Mor 9', 'รามอินทรา กม.9', 13.8420, 100.6760],
    ['PK25', 'Outer Ring Road-Ram Inthra', 'วงแหวนรามอินทรา', 13.8360, 100.6880],
    ['PK26', 'Nopparat', 'นพรัตน์', 13.8300, 100.6990],
    ['PK27', 'Bang Chan', 'บางชัน', 13.8240, 100.7100],
    ['PK28', 'Setthabutbamphen', 'เศรษฐบุตรบำเพ็ญ', 13.8180, 100.7210],
    ['PK29', 'Talat Min Buri', 'ตลาดมีนบุรี', 13.8135, 100.7300],
    ['PK30', 'Min Buri', 'มีนบุรี', 13.8110, 100.7400],
    // Muang Thong Thani branch (opened June 2025)
    ['MT01', 'Impact Muang Thong Thani', 'อิมแพ็ค เมืองทองธานี', 13.9120, 100.5470],
    ['MT02', 'Lake Muang Thong Thani', 'ทะเลสาบเมืองทองธานี', 13.9165, 100.5395],
  ],
  arl: [
    ['A1', 'Suvarnabhumi', 'สุวรรณภูมิ', 13.6981, 100.7520],
    ['A2', 'Lat Krabang', 'ลาดกระบัง', 13.7275, 100.7487],
    ['A3', 'Ban Thap Chang', 'บ้านทับช้าง', 13.7330, 100.6914],
    ['A4', 'Hua Mak', 'หัวหมาก', 13.7380, 100.6455],
    ['A5', 'Ramkhamhaeng', 'รามคำแหง', 13.7430, 100.6001],
    ['A6', 'Makkasan', 'มักกะสัน', 13.7509, 100.5607],
    ['A7', 'Ratchaprarop', 'ราชปรารภ', 13.7549, 100.5418],
    ['A8', 'Phaya Thai', 'พญาไท', 13.7568, 100.5348],
  ],
  red: [
    ['RN01', 'Krung Thep Aphiwat', 'กรุงเทพอภิวัฒน์', 13.8040, 100.5400],
    ['RN02', 'Chatuchak', 'จตุจักร', 13.8225, 100.5505],
    ['RN03', 'Wat Samian Nari', 'วัดเสมียนนารี', 13.8350, 100.5560],
    ['RN04', 'Bang Khen', 'บางเขน', 13.8480, 100.5600],
    ['RN05', 'Thung Song Hong', 'ทุ่งสองห้อง', 13.8640, 100.5720],
    ['RN06', 'Lak Si', 'หลักสี่', 13.8872, 100.5793],
    ['RN07', 'Kan Kheha', 'การเคหะ', 13.9035, 100.5935],
    ['RN08', 'Don Mueang', 'ดอนเมือง', 13.9150, 100.6040],
    ['RN09', 'Lak Hok', 'หลักหก', 13.9600, 100.6150],
    ['RN10', 'Rangsit', 'รังสิต', 13.9880, 100.6170],
  ],
  'red-light': [
    ['RW01', 'Krung Thep Aphiwat', 'กรุงเทพอภิวัฒน์', 13.8040, 100.5400],
    ['RW02', 'Bang Son', 'บางซ่อน', 13.8205, 100.5310],
    ['RW05', 'Bang Bamru', 'บางบำหรุ', 13.7975, 100.4848],
    ['RW06', 'Taling Chan', 'ตลิ่งชัน', 13.7920, 100.4565],
  ],
};

// Station ids must be unique across lines. Siam appears on two BTS lines,
// so the Silom Line's Siam node gets its own id. Krung Thep Aphiwat on the
// Light Red Line uses RW01 internally (its public code is RN01).
const idOverrides = { 'silom:CEN': 'CEN-SL' };
const codeOverrides = { RW01: 'RN01' };

// Track geometry. Each line is one or more paths (ordered station codes).
// The Blue Line is a loop with a tail; the Pink Line has a branch.
const blueLoop = S.blue.slice(0, 32).map((s) => s[0]); // BL01..BL32
const paths = {
  blue: [[...blueLoop, 'BL01'], ['BL01', 'BL33', 'BL34', 'BL35', 'BL36', 'BL37', 'BL38']],
  pink: [S.pink.slice(0, 30).map((s) => s[0]), ['PK10', 'MT01', 'MT02']],
};

// Fare zones for the BTS. Core concession: Mo Chit-On Nut and
// National Stadium-Wongwian Yai. Everything else is an extension.
const btsCore = new Set(['N8', 'N7', 'N5', 'N4', 'N3', 'N2', 'N1', 'CEN', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'W1', 'CEN-SL', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8']);

// Interchanges: [a, b, walking minutes, kind]
// kind "same" = same station complex (paid-area or short connection),
// kind "walk" = separate stations linked by a walkway or short street walk.
const interchanges = [
  ['CEN', 'CEN-SL', 2, 'same', 'Cross-platform at Siam'],
  ['BL10', 'PP16', 3, 'same', 'Change floors inside Tao Poon station'],
  ['RN01', 'RW01', 4, 'same', 'Same station, different platforms'],
  ['S7', 'G1', 4, 'same', 'Connected by walkway'],
  ['PP11', 'PK01', 5, 'same', 'Connected by walkway'],
  ['S12', 'BL34', 5, 'same', 'Connected by walkway'],
  ['BL15', 'YL01', 5, 'same', 'Connected via exit level'],
  ['N2', 'A8', 5, 'same', 'Connected by skywalk'],
  ['E15', 'YL23', 5, 'same', 'Connected by skywalk'],
  ['A4', 'YL11', 6, 'same', 'Short walk between stations'],
  ['PK14', 'RN06', 6, 'same', 'Connected by skywalk'],
  ['N17', 'PK16', 6, 'same', 'Connected by skywalk'],
  ['PP15', 'RW02', 6, 'same', 'Connected by walkway'],
  ['E4', 'BL22', 4, 'walk', 'Asok (BTS) and Sukhumvit (MRT) are linked by a walkway'],
  ['N8', 'BL13', 5, 'walk', 'Mo Chit (BTS) and Chatuchak Park (MRT) are linked by stairs and walkway'],
  ['S2', 'BL26', 4, 'walk', 'Sala Daeng (BTS) and Si Lom (MRT) are linked by a walkway'],
  ['BL21', 'A6', 6, 'walk', 'Phetchaburi (MRT) and Makkasan (ARL) are linked by a walkway'],
  ['N9', 'BL14', 5, 'walk', 'Ha Yaek Lat Phrao (BTS) and Phahon Yothin (MRT) are a short walk apart'],
  ['BL11', 'RN01', 6, 'walk', 'Bang Sue (MRT) connects to Krung Thep Aphiwat Central Terminal'],
  ['BL11', 'RW01', 6, 'walk', 'Bang Sue (MRT) connects to Krung Thep Aphiwat Central Terminal'],
];

// Extra search words (English spellings people actually type).
const aliases = {
  BL26: ['Silom'], CEN: ['Siam Paragon', 'Siam Square'], E4: ['Asoke', 'Terminal 21'],
  BL22: ['Asoke'], N8: ['Chatuchak Market', 'JJ'], BL13: ['Chatuchak Weekend Market', 'JJ'],
  A1: ['BKK', 'Suvarnabhumi Airport', 'Airport'], RN08: ['DMK', 'Don Mueang Airport'],
  S6: ['Sathorn Pier', 'Taksin'], E6: ['Thonglor', 'Thong Lor'], E7: ['Ekamai'],
  E1: ['Chidlom', 'CentralWorld'], E2: ['Ploenchit'], E5: ['Phrom Phong', 'Emporium', 'EmQuartier'],
  RN01: ['Bang Sue Grand', 'Bang Sue Central'], RW01: ['Bang Sue Grand', 'Bang Sue Central'],
  BL20: ['Rama 9', 'Rama IX'], BL28: ['Hualamphong', 'Bangkok Railway Station'],
  BL31: ['Wat Pho', 'Grand Palace'], G2: ['ICONSIAM'], BL16: ['Ratchada'],
  BL29: ['Chinatown', 'Yaowarat'], N3: ['Anusawari'], E9: ['Onnut'],
};

// Exits / direct connections we are confident about. Others are left empty.
const exits = {
  S6: [{ ref: '2', en: 'Sathorn Pier (Chao Phraya Express Boat)', th: 'ท่าเรือสาทร (เรือด่วนเจ้าพระยา)' }],
  CEN: [{ ref: null, en: 'Siam Paragon, Siam Center (direct link)', th: 'สยามพารากอน สยามเซ็นเตอร์ (ทางเชื่อม)' }],
  'CEN-SL': [{ ref: null, en: 'Siam Paragon, Siam Center (direct link)', th: 'สยามพารากอน สยามเซ็นเตอร์ (ทางเชื่อม)' }],
  E4: [{ ref: null, en: 'Terminal 21 (direct link)', th: 'เทอร์มินอล 21 (ทางเชื่อม)' }],
  E1: [{ ref: null, en: 'CentralWorld (skywalk)', th: 'เซ็นทรัลเวิลด์ (สกายวอล์ก)' }],
  E5: [{ ref: null, en: 'Emporium, EmQuartier (direct link)', th: 'เอ็มโพเรียม เอ็มควอเทียร์ (ทางเชื่อม)' }],
  G2: [{ ref: null, en: 'ICONSIAM (direct link)', th: 'ไอคอนสยาม (ทางเชื่อม)' }],
  BL13: [{ ref: null, en: 'Chatuchak Weekend Market, Chatuchak Park', th: 'ตลาดนัดจตุจักร สวนจตุจักร' }],
  W1: [{ ref: null, en: 'MBK Center, BACC (skywalk)', th: 'มาบุญครอง หอศิลป์ กทม. (สกายวอล์ก)' }],
  A1: [{ ref: null, en: 'Suvarnabhumi Airport terminal (basement level)', th: 'อาคารผู้โดยสารสนามบินสุวรรณภูมิ (ชั้นใต้ดิน)' }],
  BL27: [{ ref: null, en: 'Samyan Mitrtown (direct link)', th: 'สามย่านมิตรทาวน์ (ทางเชื่อม)' }],
  BL31: [{ ref: null, en: 'Wat Pho, Grand Palace (walk)', th: 'วัดโพธิ์ พระบรมมหาราชวัง (เดิน)' }],
};

// Running-time overrides for long gaps (minutes between the two stations).
const segmentMinutes = {
  'RN08|RN09': 5, 'RN09|RN10': 4, 'RW02|RW05': 6, 'RW05|RW06': 5, 'RN01|RW02': 4, 'RW01|RW02': 4,
  'A1|A2': 5, 'A2|A3': 5, 'A3|A4': 4, 'A4|A5': 3, 'A5|A6': 4, 'A6|A7': 3, 'A7|A8': 2,
};

// ---------------------------------------------------------------------------
// Fares. Checked on CHECKED_ON.
// Official station-to-station tables live in tools/sources/fares/*.json,
// each with its source links and effective date. Anything not backed by an
// official table or rule has status 'estimate' and the app shows it as
// "about X THB".
// ---------------------------------------------------------------------------
const src = (name) => JSON.parse(readFileSync(join(root, 'tools', 'sources', 'fares', name), 'utf8'));
const btsSrc = src('bts.json');
const blueSrc = src('blue.json');
const purpleSrc = src('purple.json');
const yellowSrc = src('yellow.json');
const srtSrc = src('srt.json');

const OFFICIAL = { adult: 'official', student: 'official', senior: 'official' };
const ESTIMATE = { adult: 'estimate', student: 'estimate', senior: 'estimate' };

const fares = {
  checked_on: CHECKED_ON,
  currency: 'THB',
  summary_en: 'Each operator charges separately. Fares are per journey for adult, student and senior cards. Changing to a different operator means paying a new fare.',
  summary_th: 'แต่ละผู้ให้บริการคิดค่าโดยสารแยกกัน ราคาต่อเที่ยวสำหรับบัตรผู้ใหญ่ นักเรียน และผู้สูงอายุ การเปลี่ยนไปสายของผู้ให้บริการอื่นต้องจ่ายค่าโดยสารใหม่',
  dailyCap: {
    amount: 40, lines: ['purple', 'red', 'red-light'],
    note: 'With an EMV contactless card: 40 baht all-day cap on Purple + Red lines (30 baht for students). Reported; check before relying on it.',
    note_th: 'ใช้บัตร EMV: สายสีม่วงและสีแดงจ่ายสูงสุด 40 บาทต่อวัน (นักศึกษา 30 บาท) เป็นข้อมูลจากรายงานข่าว โปรดตรวจสอบก่อนเดินทาง',
  },
  systems: {
    bts: {
      name_en: 'BTS Skytrain (Sukhumvit + Silom)', name_th: 'บีทีเอส (สุขุมวิท + สีลม)',
      lines: ['sukhumvit', 'silom'],
      model: 'matrix', key: 'code', table: btsSrc,
      status: OFFICIAL,
      effective: btsSrc.effective,
      note: 'Official BTS station-to-station tables for Rabbit card adults, students and seniors, effective 1 Nov 2025. Extensions are 17-45 baht; trips crossing core and extension are capped at 65.',
      note_th: 'ตารางค่าโดยสารทางการของบีทีเอสรายสถานี สำหรับบัตรแรบบิทผู้ใหญ่ นักเรียน และผู้สูงอายุ มีผล 1 พ.ย. 2568 ส่วนต่อขยาย 17-45 บาท เดินทางข้ามส่วนหลักและส่วนต่อขยายไม่เกิน 65 บาท',
      child: { en: 'Children under 90 cm ride free.', th: 'เด็กสูงไม่เกิน 90 ซม. โดยสารฟรี', confirmed: false },
      sources: [
        { label: 'BTS fare table, adult (PDF)', url: btsSrc.sources.adult },
        { label: 'BTS fare table, student (PDF)', url: btsSrc.sources.student },
        { label: 'BTS fare table, senior (PDF)', url: btsSrc.sources.senior },
      ],
    },
    gold: {
      name_en: 'BTS Gold Line', name_th: 'สายสีทอง', lines: ['gold'],
      model: 'flat', flat: { adult: 17, student: 17, senior: 8 },
      status: ESTIMATE,
      note: 'Flat fare, paid separately from the main BTS. 17 baht from 1 Jan 2026 and 8 baht for Thai seniors, as reported in the news; not found on an official fare page.',
      note_th: 'ราคาเดียวตลอดสาย ชำระแยกจากบีทีเอสสายหลัก 17 บาท ตั้งแต่ 1 ม.ค. 2569 และผู้สูงอายุ 8 บาท ตามรายงานข่าว ยังไม่พบในหน้าค่าโดยสารทางการ',
      child: { en: 'Children under 90 cm ride free.', th: 'เด็กสูงไม่เกิน 90 ซม. โดยสารฟรี', confirmed: false },
      sources: [{ label: 'The Nation, Gold Line fare', url: 'https://www.nationthailand.com/news/general/40059831' }],
    },
    mrt: {
      name_en: 'MRT Blue + Purple (BEM)', name_th: 'MRT สายสีน้ำเงิน + สีม่วง',
      lines: ['blue', 'purple'],
      model: 'mrt',
      blue: { byStations: blueSrc.byStations },
      purple: { codes: purpleSrc.codes, adult: purpleSrc.adult },
      transferEntryCredit: 14,
      status: { adult: 'official', student: 'estimate', senior: 'official' },
      effective: blueSrc.effective,
      note: 'Official MRTA fares from 3 Jul 2026: Blue Line 17-44 baht by stations travelled; Purple Line 14-42 baht from a station-to-station table. Seniors 60+ pay half (rounded up). No official student discount found, so student fares are estimates. Trips that change between Blue and Purple at Tao Poon are estimates.',
      note_th: 'ค่าโดยสารทางการของ รฟม. ตั้งแต่ 3 ก.ค. 2569: สายสีน้ำเงิน 17-44 บาท ตามจำนวนสถานี สายสีม่วง 14-42 บาท ตามตารางรายสถานี ผู้สูงอายุ 60 ปีขึ้นไปจ่ายครึ่งราคา (ปัดขึ้น) ไม่พบส่วนลดนักเรียนอย่างเป็นทางการ ราคานักเรียนจึงเป็นการประมาณ การเดินทางที่เปลี่ยนสายสีน้ำเงิน-สีม่วงที่เตาปูนเป็นการประมาณ',
      child: { en: 'Children up to 120 cm ride free.', th: 'เด็กสูงไม่เกิน 120 ซม. โดยสารฟรี', confirmed: true },
      sources: [
        { label: 'Royal Gazette, Blue Line fares (PDF)', url: blueSrc.sources.adult },
        { label: 'Royal Gazette, Purple Line fares (PDF)', url: purpleSrc.sources.adult },
        { label: 'Thai PBS, Blue Line fare table', url: blueSrc.sources.report },
      ],
    },
    yellow: {
      name_en: 'MRT Yellow Line', name_th: 'สายสีเหลือง', lines: ['yellow'],
      model: 'matrix', key: 'id', table: yellowSrc,
      status: { adult: 'official', student: 'estimate', senior: 'official' },
      effective: yellowSrc.effective,
      note: 'Official EBM station-to-station tables: 15-45 baht for adults, 8-23 baht for senior Rabbit cards. No student table is published, so student fares are estimates.',
      note_th: 'ตารางค่าโดยสารทางการของ EBM รายสถานี: ผู้ใหญ่ 15-45 บาท บัตรแรบบิทผู้สูงอายุ 8-23 บาท ไม่มีตารางนักเรียนเผยแพร่ ราคานักเรียนจึงเป็นการประมาณ',
      sources: [
        { label: 'EBM Yellow Line fare table, adult (PDF)', url: yellowSrc.sources.adult },
        { label: 'EBM Yellow Line fare table, senior (PDF)', url: yellowSrc.sources.senior },
      ],
    },
    pink: {
      name_en: 'MRT Pink Line', name_th: 'สายสีชมพู', lines: ['pink'],
      model: 'linear', base: 15, perStation: 10 / 3, max: 45, seniorRule: 'half-up',
      status: ESTIMATE,
      note: '15-45 baht by distance. No official station-to-station table found, so every Pink Line fare is an estimate.',
      note_th: '15-45 บาท ตามระยะทาง ไม่พบตารางรายสถานีทางการ ค่าโดยสารสายสีชมพูทั้งหมดเป็นการประมาณ',
      sources: [{ label: 'Mapa Metro, Pink Line', url: 'https://mapa-metro.com/en/thailand/bangkok/pink-line-bangkok-map.htm' }],
    },
    arl: {
      name_en: 'Airport Rail Link', name_th: 'แอร์พอร์ต เรล ลิงก์', lines: ['arl'],
      model: 'table', table: [15, 20, 25, 30, 35, 40, 45],
      status: ESTIMATE,
      note: '15-45 baht; Suvarnabhumi-Phaya Thai 45 baht. No official fare table found online, so these are estimates.',
      note_th: '15-45 บาท สุวรรณภูมิ-พญาไท 45 บาท ไม่พบตารางค่าโดยสารทางการออนไลน์ จึงเป็นการประมาณ',
      sources: [
        { label: 'Trip.com, Airport Rail Link fares', url: 'https://us.trip.com/guide/transport/bangkok-airport-rail-link.html' },
        { label: 'RailTravel Station, ARL review', url: 'https://railtravelstation.com/aera1-city-line-suvarnabhumi-airport-phaya-thai/' },
      ],
    },
    srt: {
      name_en: 'SRT Red Lines', name_th: 'รถไฟชานเมืองสายสีแดง', lines: ['red', 'red-light'],
      model: 'matrix', key: 'name', table: srtSrc,
      status: OFFICIAL,
      effective: srtSrc.effective,
      note: 'Official SRTET station-to-station tables for adults, students and seniors (12-42 baht for adults). Dark and Light Red count as one journey.',
      note_th: 'ตารางค่าโดยสารทางการของ รฟฟท. รายสถานี สำหรับผู้ใหญ่ นักเรียน และผู้สูงอายุ (ผู้ใหญ่ 12-42 บาท) สายสีแดงเข้มและอ่อนนับเป็นเที่ยวเดียว',
      sources: [{ label: 'SRTET fare information', url: srtSrc.sources.adult }],
    },
  },
  upcoming: [
    {
      en: 'Planned from 1 Jan 2027: a 17-45 baht common fare across all lines for Thai nationals who register an EMV card (or Rabbit card on Green, Gold, Yellow, Pink) through the Paotang app. Foreign visitors keep paying standard fares. Not in effect yet.',
      th: 'แผนเริ่ม 1 ม.ค. 2570: ค่าโดยสารร่วม 17-45 บาททุกสาย สำหรับคนไทยที่ลงทะเบียนบัตร EMV (หรือบัตรแรบบิทในสายสีเขียว ทอง เหลือง ชมพู) ผ่านแอปเป๋าตัง ชาวต่างชาติจ่ายอัตราปกติ ยังไม่มีผลบังคับใช้',
      sources: ['https://www.nationthailand.com/news/general/40072034', 'https://www.nationthailand.com/news/general/40067115'],
    },
  ],
  notes: [
    { en: 'Paying with the same EMV card, the entry fare is reportedly refunded when changing Purple to Pink or Blue to Yellow. Not applied in our totals.', th: 'หากใช้บัตร EMV ใบเดียวกัน มีรายงานว่าคืนค่าแรกเข้าเมื่อเปลี่ยนจากสายสีม่วงไปสีชมพู หรือสีน้ำเงินไปสีเหลือง ยังไม่ได้นำมาคำนวณ' },
    { en: 'Student and senior cards need ID. BTS student cards are for full-time students aged 23 or under; senior cards are for Thai nationals aged 60 and over.', th: 'บัตรนักเรียนและผู้สูงอายุต้องแสดงบัตรประจำตัว บัตรนักเรียนบีทีเอสสำหรับนักเรียนนักศึกษาอายุไม่เกิน 23 ปี บัตรผู้สูงอายุสำหรับผู้มีสัญชาติไทยอายุ 60 ปีขึ้นไป' },
  ],
};

// ---------------------------------------------------------------------------
// Assemble
// ---------------------------------------------------------------------------
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const stations = [];
const byId = new Map();
for (const line of lines) {
  S[line.id].forEach(([code, en, th, lat, lng], i) => {
    const id = idOverrides[`${line.id}:${code}`] || code;
    if (byId.has(id)) throw new Error(`Duplicate station id ${id}`);
    const st = {
      id, code: codeOverrides[id] || code, name_en: en, name_th: th, line: line.id, order: i + 1,
      lat, lng, place: slug(en), interchanges: [],
    };
    if (aliases[id]) st.aliases = aliases[id];
    st.exits = exits[id] || [];
    if (line.id === 'sukhumvit' || line.id === 'silom') st.fareZone = btsCore.has(id) ? 'core' : 'extension';
    stations.push(st);
    byId.set(id, st);
  });
}

// Paths in station ids
for (const line of lines) {
  const toId = (code) => idOverrides[`${line.id}:${code}`] || code;
  line.paths = (paths[line.id] || [S[line.id].map((s) => s[0])]).map((p) => p.map(toId));
}

// Segments with minutes
const segments = [];
for (const line of lines) {
  for (const p of line.paths) {
    for (let i = 0; i + 1 < p.length; i++) {
      const [a, b] = [p[i], p[i + 1]];
      const minutes = segmentMinutes[`${a}|${b}`] ?? segmentMinutes[`${b}|${a}`] ?? line.minutesPerStop;
      segments.push({ line: line.id, from: a, to: b, minutes });
    }
  }
}

for (const [a, b, minutes, kind, note] of interchanges) {
  for (const [x, y] of [[a, b], [b, a]]) {
    if (!byId.has(x)) throw new Error(`Unknown interchange station ${x}`);
    byId.get(x).interchanges.push({ to: y, minutes, kind, note });
  }
}

// Index each official fare table by our station ids, so the app can look
// a fare up directly: tables.index[stationId] -> row/column number.
const srtNames = { 'Bang Bumru': 'Bang Bamru' }; // SRTET spelling -> ours
for (const rule of Object.values(fares.systems)) {
  if (rule.model !== 'matrix') continue;
  const t = rule.table;
  delete rule.table;
  const labels = t.codes || t.names;
  const index = {};
  for (const st of stations.filter((s) => rule.lines.includes(s.line))) {
    const key = rule.key === 'code' ? st.code : rule.key === 'id' ? st.id : st.name_en;
    let i = labels.indexOf(key);
    if (i < 0 && rule.key === 'name') i = labels.findIndex((n) => srtNames[n] === st.name_en);
    if (i < 0) throw new Error(`No fare table row for ${st.id} (${key})`);
    index[st.id] = i;
  }
  rule.tables = { index, adult: t.adult };
  if (t.student) rule.tables.student = t.student;
  if (t.senior) rule.tables.senior = t.senior;
  rule.fallbackMax = Math.max(...t.adult.flat());
}
{
  const p = fares.systems.mrt.purple;
  p.index = Object.fromEntries(p.codes.map((c, i) => [c, i]));
  delete p.codes;
}

// Places: stations grouped by English name (what people pick in the UI)
const placeMap = new Map();
for (const st of stations) {
  if (!placeMap.has(st.place)) placeMap.set(st.place, { id: st.place, name_en: st.name_en, name_th: st.name_th, stations: [] });
  placeMap.get(st.place).stations.push(st.id);
}

// Short names for the line pills, and a pill text colour with strong
// contrast on the official line colour (white where it reads well, navy
// on the light colours).
const pillLabels = {
  sukhumvit: ['BTS Sukhumvit', 'BTS สุขุมวิท'], silom: ['BTS Silom', 'BTS สีลม'], gold: ['Gold Line', 'สายสีทอง'],
  blue: ['MRT Blue', 'MRT สีน้ำเงิน'], purple: ['MRT Purple', 'MRT สีม่วง'], yellow: ['MRT Yellow', 'MRT สีเหลือง'],
  pink: ['MRT Pink', 'MRT สีชมพู'], arl: ['Airport Rail Link', 'แอร์พอร์ต เรล ลิงก์'],
  red: ['SRT Dark Red', 'สายสีแดงเข้ม'], 'red-light': ['SRT Light Red', 'สายสีแดงอ่อน'],
};
const NAVY = '#0F1B33';
function luminance(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
for (const line of lines) {
  [line.label_en, line.label_th] = pillLabels[line.id];
  line.text = contrast(line.color, '#FFFFFF') >= 4.5 ? '#FFFFFF' : NAVY;
}

// Platform numbers per station (researched; see tools/sources/platforms.json).
// Only stations whose platforms could be confirmed are listed.
const platformsFile = join(root, 'tools', 'sources', 'platforms.json');
if (existsSync(platformsFile)) {
  const platforms = JSON.parse(readFileSync(platformsFile, 'utf8')).stations;
  for (const [id, info] of Object.entries(platforms)) {
    const st = byId.get(id);
    if (!st) throw new Error(`Platform data for unknown station ${id}`);
    st.platforms = info.platforms;
    st.platform_sources = info.sources;
  }
}

const data = {
  meta: {
    name: 'Metro Buddy - Bangkok rail network',
    compiled: CHECKED_ON,
    note: 'Coordinates are approximate. Running times are averages and include dwell time. Wait times are about half the daytime headway.',
  },
  lines: lines.map(({ id, short, name_en, name_th, label_en, label_th, color, text, operator, fareSystem, minutesPerStop, waitMinutes, paths: p }) =>
    ({ id, short, name_en, name_th, label_en, label_th, color, text, operator, fareSystem, minutesPerStop, waitMinutes, paths: p })),
  stations,
  places: [...placeMap.values()],
  segments,
  fares,
};

writeFileSync(join(root, 'data', 'transit.json'), JSON.stringify(data, null, 1));
console.log(`Wrote ${stations.length} stations, ${placeMap.size} places, ${segments.length} segments.`);
