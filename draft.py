from io import BytesIO
import pandas as pd
import requests

r = requests.get('https://docs.google.com/spreadsheets/d/e/2PACX-1vSus1t39Sy6KKMDn3gaBwpcykMhTIUIEf0vLiAjTqv_IZb0uAyoIo_C6ncm73TR9hk6TZyDrvawqwRH/pub?gid=0&single=true&output=csv')
data = r.content

df = pd.read_csv(BytesIO(data), names=['ConferenceName', 'Acronym', 'CORE2023', 'Year', 'AnonymityStarts', 'PaperDue', 'NotifOfAcceptance', 'ConfStarts', 'ConfEnds'], header=0)
                #  parse_dates=['Paper due']

print(df)
