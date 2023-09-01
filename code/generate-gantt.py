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
#                   , facet_col="Dimension"
#                   , facet_col_wrap=40
#                   , facet_col_spacing=.99
#                   , color_discrete_sequence=['green']*len(df)
                  , color_discrete_sequence=px.colors.qualitative.Prism
                  , opacity=.7
#                   , text="Task"
                  , range_x=None
                  , range_y=None
                  , template='plotly_white'
                  , height=800
                  , width=1500
                  , color='CORE2023'
                  , title =f"<b>{title}</b>"
                 )

fig.update_layout(
    bargap=0.5
    ,bargroupgap=0.1
    ,xaxis_range=[df[f'{start}'].min(), df[f'{end}'].max()]
    ,xaxis = dict(
        showgrid=True
        ,rangeslider_visible=True
        ,side ="top"
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
            family='Old Standard TT, serif',size=24,color='gray')

        # set a range selector at the bottom of the window to select a custom timespan
    #     ,rangeselector=dict(
    #         buttons=list([
    #             dict(count=1, label="1m", step="month", stepmode="backward"),
    #             dict(count=6, label="6m", step="month", stepmode="backward"),
    #             dict(count=1, label="YTD", step="year", stepmode="todate"),
    #             dict(count=1, label="1y", step="year", stepmode="backward"),
    #             dict(step="all")
    #         ])
    #         ,x=.37
    #         ,y=-.05
    #         ,font=dict(
    #             family="Arial",
    #             size=14,
    #             color="darkgray"
    # ))
    )
    
    ,yaxis = dict(
        title= ""
        ,autorange=True #"reversed"
        ,automargin=True
#         ,anchor="free"
        ,ticklen=10
        ,showgrid=True
        ,showticklabels=True
        ,tickfont=dict(
            family='Old Standard TT, serif', size=16, color='gray'))
    
    ,legend=dict(
        orientation="h"
        ,yanchor="bottom"
        ,y=1.1
        ,title=""
        ,xanchor="right"
        ,x=1
        ,font=dict(
            family="Arial"
            ,size=14
            ,color="darkgray"))
)

fig.update_traces( #marker_color='rgb(158,202,225)'
                   marker_line_color='rgb(8,48,107)'
                  , marker_line_width=1.5, opacity=0.95)

fig.update_layout(
    title=f"<b>{title}</b>",
    xaxis_title="",
#     margin_l=400,
    yaxis_title="Conferences",
    legend_title="Rank: ",
    font=dict(
        family="Arial",
        size=24,
        color="darkgray"
    )
)

fig.show()
fig.write_html(f"./outputs/ganttchart_{get_datetime()}")
go.FigureWidget(fig)
