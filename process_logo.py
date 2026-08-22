import xml.etree.ElementTree as ET
import base64
import io
from PIL import Image

try:
    tree = ET.parse('public/logo.svg')
    root = tree.getroot()
    ns = {'xlink': 'http://www.w3.org/1999/xlink'}
    image_elem = root.find('.//{http://www.w3.org/2000/svg}image')
    if image_elem is not None:
        href = image_elem.attrib.get('{http://www.w3.org/1999/xlink}href')
        if href and href.startswith('data:image/jpeg;base64,'):
            b64_data = href.split(',')[1]
            image_data = base64.b64decode(b64_data)
            
            img = Image.open(io.BytesIO(image_data))
            img = img.convert("RGBA")
            datas = img.getdata()

            newData = []
            for item in datas:
                # change all white (also shades of whites) to transparent
                if item[0] > 220 and item[1] > 220 and item[2] > 220:
                    newData.append((255, 255, 255, 0))
                else:
                    newData.append(item)

            img.putdata(newData)
            img.save("public/logo_transparent.png", "PNG")
            print("Successfully extracted and made logo transparent.")
        else:
            print("Not base64 jpeg.")
    else:
        print("No image element found.")
except Exception as e:
    print("Error:", e)
