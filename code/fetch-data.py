'''
Fetch data from the google slides spreadsheet, build a Pandas dataframe out of it and store it in a Pickle format in a ./data/ folder
'''

from io import BytesIO
import pandas as pd
import requests
import numpy as np


def fetch_data():
    r = requests.get('https://docs.google.com/spreadsheets/d/e/2PACX-1vSus1t39Sy6KKMDn3gaBwpcykMhTIUIEf0vLiAjTqv_IZb0uAyoIo_C6ncm73TR9hk6TZyDrvawqwRH/pub?gid=0&single=true&output=csv')
    data = r.content

    df = pd.read_csv(BytesIO(data), names=['ConferenceName', 'Acronym', 'CORE2023', 'Year', 'AnonymityStarts', 'PaperDue', 'NotifOfAcceptance', 'ConfStarts', 'ConfEnds'], header=0, parse_dates=['AnonymityStarts', 'PaperDue', 'NotifOfAcceptance', 'ConfStarts', 'ConfEnds'], dayfirst=True)

    return df

df = fetch_data()
df.to_pickle('./data/nlp_conferences_data.pkl')
