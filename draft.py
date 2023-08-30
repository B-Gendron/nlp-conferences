from io import BytesIO
import pandas as pd
import requests

r = requests.get('https://docs.google.com/spreadsheets/d/1QCnD7HpnaAkYqb4f70uqqmOtZL_IYoAuRRe8AeF6stI/edit#gid=0&output=csv')
data = r.content

df = pd.read_csv(BytesIO(data), names=['ConferenceName', 'Acronym', 'CORE2023', 'Year', 'AnonymityStarts', 'PaperDue', 'NotifOfAcceptance', 'ConfStarts', 'ConfEnds'], error_bad_lines=False)
                #  parse_dates=['Paper due']
print(df.head())
