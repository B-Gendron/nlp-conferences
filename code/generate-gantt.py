'''
Generate a gantt chart from data saved locally in ./data/ folder.
Most of the following code is adapted from https://github.com/maxwellbade/plotly_gantt_chart/blob/main/diagrams%20(1).ipynb.
'''

import pandas as pd
import plotly.express as px
import plotly.figure_factory as ff
import plotly.graph_objs as go
import chart_studio
import chart_studio.plotly as py 
import chart_studio.tools as tls
import argparse

df = pd.read_pickle('./data/nlp_conferences_data.pkl')
# print(df.dtypes)
# print(df.head())
# exit()

# argparse arguments retrieval


# select the appropriate subset of dataframe to process according to the user's requirements

colors = {'Technology' : 'rgb(30,144,255)'
          , 'Technology - Date TBD' : 'rgb(211,211,211)'
          , 'People' : 'rgb(95,158,160)'
          , 'Process' : 'rgb(0,0,128)'
          , 'Process - Date TBD' : 'rgb(211,211,210)'}
    
orders = list(df['Task'])

fig = px.timeline(df
                  , x_start="Start"
                  , x_end="Finish"
                  , y="Resource"
                  , hover_name="Task"
#                   , facet_col="Dimension"
#                   , facet_col_wrap=40
#                   , facet_col_spacing=.99
#                   , color_discrete_sequence=['green']*len(df)
                  , color_discrete_sequence=px.colors.qualitative.Prism
                  , category_orders={'Task':['Results of Task','Establish and agree upon Agile standards/framework','Communicate Agile structure to business groups','Select proper tooling','Results of Task','Refine analytic data use operating model','Define analytic persona\x92s and use cases','Define operational data use operating model','Define operational persona\x92s and use cases ','Define standard ','Results of Task','ID appropriate use case requirements for applying methodology (i.e. what are expectations from the business, what are deliverable expectations etc.)',
                                     'Create template for data use stories (i.e. data sets, data presentation, data analysis, Data validation, advanced analytic stories)','Results of Task','Identify product advisory council attendees','Create governance model/methodology','Results of Task','ID all candidate roles and process to keep bench as opposed to OJT','ID incentive and disincentive components to manage contract','ID candidate partners for various work components','Create methodology to manage bid process and selection \x96 partner with procurement','Results of task','Define scope of project','Results of task','ID tools for self-service ties to tools/tech','Determine extent of centrally managed policy engines','What multi-tenancy restrictions should be established','Access control \x96 Tie to IT IAM strategy','Evaluate security, PHI, access restrictions','Results of task','Publish product and service catalog outlining initial build/implementation of the product or service as well as the ongoing costs','Results of task','ID standard tools for self-service','Create governance and methodology use cases','Create training protocol for tool consumption',
                                     'Database/System design for persistent data to be stored on remote, network attached storage','Identify systems requirements','Technology/vendor selection','Migration effort to be considered; layout strategy','Downstream efforts - existing processes to migrate; how to enable a seamless transition; which approach to use - coexist or turn off/turn on','Enable S3 as primary storage, move away from other storage solutions and determine config','Establish rules/processes to ensure S3 is the primary storage solution','Recompilation and redeployment of jobs is required','Stand up non-prod two node cluster job/script execution','Decommission version 5 by May 21 2021','Results of task','Identify self-service needs/requirements for each group ','Identify the right tool for the right purpose','Learning and creating guidelines on how to use new tools','Estimate adoption rate','Gauge time to ramp-up','Evaluate if migration from existing tools to new tools is required',
                                     'Results of task','Identify compatible tooling','Determine requirements specific for each business group','Identify VDI-based security issues for additional R/Python libraries','Document and communicate procedure to add new ML features/libraries to remote environments','Estimate value of paid tools vs free libraries','Determine if automated ML tools are necessary (Datarobot vs Azure ML)','Gauge level of adoption','Document FAQs and consider questions specific to each business group','Results of task','Determine scope \x96 DR, HA, Extent of insight and notification needs','Establish continuous monitoring needs aligned with DevOps','Resiliency testing approach','Monitoring tools','Incident response communication protocol (ties to governance and operating model)','Identify compatible tooling/technology','Consider location/region-based connection practices',
                                     'Consider multiple physical data center connection locations for resiliency to connectivity failures due to fiber cut, device failure or complete location failure','Determine if dynamically routed and active connections vs. statically routed for load balancing and failover','Results of task','Identify compatible tooling','Determine instance requirements specific for each business group','Launch instances and document keys/passwords','Communicate instance configurations and setup notes to each group','Estimate level of adoption','Predict and document FAQs','Document how to use Microsoft Remote Desktop Apps for Mac users','Install supporting software (R, Python, Firefox etc.)','Identify an owner/manager of compute elasticity/infrastructure operations',
                                     'Identify rules of engagement and governance for when the process is live','Results of task','Prioritize data pipelines (tie to Data COE)','Pilot analytics in data pipeline (tie to NextBlue AA COE)','Define event streaming hub approach (i.e. people process tech)','Determine appropriate/compatible event streaming tools (Apache Kafka, Hazelcast Jet etc.)','Determine streaming rate requirements specific to each business group','Map out the data flow/data architecture and associated patterns','Identify who will do the publishing framework','Deploy and document','There are dependencies on infrastructure prior to putting this in place','Results of task','Define tools/tech and associated dependencies','Align with cloud COE','Establish development guidelines','Pilot?','Tie to governance and operating model \x96 when to use how to use etc.','Determine which tasks will be microservices','Determine tools to run/containerize microservices',
                                     'Select a microservice deployment strategy (Service Instance per Host, Multiple Service Instances per Host, Service Instance per Virtual Machine etc.)','Determine if you need a cluster manager (Kubernetes, Marathon etc.)','Identify enablement approach','Results of task','Define tools/tech and associated dependencies','Align with cloud COE','Establish development guidelines','Pilot?','Tie to governance and operating model \x96 when to use how to use etc.','Determine whether to containerize existing legacy application without refactoring into microservices','Identify barriers between security and devops','Determine drawbacks: such as container infrastructure is not as mature or secure as the infrastructure for VMs (containers share the kernel of the host OS with one another)','Results of task','Identify a back-end physical infrastructure to enable digital tools','Evaluate a hybrid cloud strategy (with an eye for the worker UX)',
                                     'Evaluate existing support services for the workplace','Implement technology for a real-time, 360 view of the UX','Results of task','Orchestration and management of services, applications and data flow','Automation of business processes','Establishment of federated security and Single Sign-On','System logging and monitoring','Data analysis, reporting and predictions','Monitoring of mobile and IoT devices','Implementation of Big Data solutions','Centralized (mobile ready) web solutions for clients and employees','Scalability and high-load support','SaaS and multi-tenancy support','Centralized control of infrastructure management etc.','Results of task','Determine compatible tools','Identify downfalls of low code platforms','Estimate adoption rate',
                                     'Results of task','Determine the FHIR server architecture','Determine compatibility of servers and FHIR versions to ensure interoperability','Understand the APIs as well as the level of completion per API','Identify where to put/install the FHIR server','Estimate adoption rate','Results of task','ID priority governance model evaluation needs \x96 self-service, machine learning model productionalization, operational area use and interaction']}
                  , opacity=.7
#                   , text="Task"
                  , range_x=None
                  , range_y=None
                  , template='plotly_white'
                  , height=800
                  , width=1500
                  , color='Dimension'
                  , title ="<b>IE 3.0 Gantt Chart 2021</b>"
#                   , color=colors
                 )

fig.update_layout(
    bargap=0.5
    ,bargroupgap=0.1
    ,xaxis_range=[df.Start.min(), df.Finish.max()]
    ,xaxis = dict(
        showgrid=True
        ,rangeslider_visible=True
        ,side ="top"
        ,tickmode = 'array'
        ,dtick="M1"
        ,tickformat="Q%q %Y \n"
        ,ticklabelmode="period"        
        ,ticks="outside"
        ,tickson="boundaries"
        ,tickwidth=.1
        ,layer='below traces'
        ,ticklen=20
        ,tickfont=dict(
            family='Old Standard TT, serif',size=24,color='gray')
        ,rangeselector=dict(
            buttons=list([
                dict(count=1, label="1m", step="month", stepmode="backward"),
                dict(count=6, label="6m", step="month", stepmode="backward"),
                dict(count=1, label="YTD", step="year", stepmode="todate"),
                dict(count=1, label="1y", step="year", stepmode="backward"),
                dict(step="all")
            ])
            ,x=.37
            ,y=-.05
            ,font=dict(
                family="Arial",
                size=14,
                color="darkgray"
    )))
    
    ,yaxis = dict(
        title= ""
        ,autorange="reversed"
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
    title="<b>IE 3.0 Gantt Chart 2021</b>",
    xaxis_title="",
#     margin_l=400,
    yaxis_title="Initiatives",
#     legend_title="Dimension: ",
    font=dict(
        family="Arial",
        size=24,
        color="darkgray"
    )
)

# fig.show()
fig.write_html("./outputs/ganttchart_{}")
go.FigureWidget(fig)
