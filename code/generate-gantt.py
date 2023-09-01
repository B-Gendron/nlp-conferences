"""
Generate a gantt chart from data saved locally in ./data/ folder.
Most of the following code is adapted from https://github.com/maxwellbade/plotly_gantt_chart/blob/main/diagrams%20(1).ipynb.
"""

import pandas as pd
import plotly.express as px
import plotly.figure_factory as ff
import plotly.graph_objs as go
import chart_studio
import chart_studio.plotly as py 
import chart_studio.tools as tls
import argparse
from utils import *

df = pd.read_pickle('./data/nlp_conferences_data.pkl')
# print(df.dtypes)
# print(df.head())
# exit()

# argparse arguments retrieval
parser = argparse.ArgumentParser()
parser.add_argument("-y", "--year", help="Select the year to consider for the Gantt chart. Default is current year or the year after if current is not in the dataframe.", type=int, default=get_default_year(df)) 
parser.add_argument("-s", "--show", help="Select what timespans to display between 'deadlines' (shows timespans from paper due to notification of acceptance) and 'conf' (shows when the conference starts and ends).", default='conf')

arguments = parser.parse_args() 
year = arguments.year
show = arguments.show

start, end = "", ""
if show == 'deadlines':
    start, end = 'PaperDue', 'NotifOfAcceptance'
elif show == 'conf':
    start, end = 'ConfStarts', 'ConfEnds'

title = "NLP-related conferences - Venue schedule" if show == "conf" else "NLP-related conferences - Submission deadlines"

# select the appropriate subset of dataframe to process according to the user's requirements
df = select_data_subset(df, year, show)

fig = px.timeline(df
                , x_start=start
                , x_end=end
                , y="Acronym"
                , hover_name="ConferenceName"
                , color_discrete_sequence=px.colors.qualitative.Prism
                , opacity=.7
                , text="Acronym"
                , range_x=None
                , range_y=None
                , template='plotly_white'
                , height=800
                , width=1500
                , color='CORE2023'
                , title =f"<b>{title}</b>"
                )

fig.update_layout(
    bargap=0.5 #0.5
    ,bargroupgap=0.1 #0.1
    ,xaxis_range=[df[f'{start}'].min(), df[f'{end}'].max()]
    ,xaxis = dict(
        showgrid=True
        ,rangeslider_visible=True # try to configure default position of range slider 
        ,side ="top" # "top"
        ,tickmode = 'array'
        ,dtick="M1"
        ,tickformat="%d/%m/%Y\n" #"Q%q %Y \n"
        ,ticklabelmode="period"        
        ,ticks="outside"
        ,tickson="boundaries"
        ,tickwidth=.1
        ,layer='below traces'
        ,ticklen=20
        ,tickfont=dict(
            family='Old Standard TT, serif',size=18,color='gray'))
    
    ,yaxis = dict(
        title= ""
        ,autorange='reversed'  # True, False or "reversed"
        ,automargin=True # True
#         ,anchor="free"
        ,ticklen=10
        ,showgrid=True
        ,showticklabels=True
        ,tickfont=dict(
            family='Old Standard TT, serif', size=16, color='gray'))
    
    ,legend=dict(
        orientation="h"
        ,yanchor="bottom"
        ,y=1.2
        ,title=""
        ,xanchor="right"
        ,x=1
        ,font=dict(
            family="Arial"
            ,size=14
            ,color="darkgray"))

    ,title=dict(
        text=f"<b>{title}</b>"
        ,y=0.98
    )
)


fig.update_layout(
    # title=f"<b>{title}</b>",
    xaxis_title="",
    yaxis_title="Conferences",
    legend_title="Rank: ",
    font=dict(
        family="Arial",
        size=20,
        color="darkgray"
    )
)

# fig.update_layout(
#     title=f"<b>{title}</b>",
#     margin = dict(l=0, r=0, t=0, b=10)
# )

fig.show(config={'displayModeBar': False})
fig.write_html(f"./outputs/ganttchart_{get_datetime()}.html", include_plotlyjs=True, config={'displayModeBar': False})
go.FigureWidget(fig)
