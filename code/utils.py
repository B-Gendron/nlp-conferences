from datetime import datetime
import pandas as pd
from termcolor import colored

def get_datetime():
    '''
        This function gets the current date time and returns it as a string.

        @returns dt_string (str): current time formatted in a string
    '''
    now = datetime.now()
    dt_string = now.strftime("%d%m%Y%H%M%S")
    return dt_string


def get_default_year(df):
    now = datetime.now()
    year = int(now.strftime("%Y"))

    return year if year in df['Year'] else year+1


def args2filename(dico):
    '''
        This function builds a file name regarding the parameters of the experiment given in a dictionnary

        @param dico (dict): a parameters dictionnary

        @returns filename (str): a string to name a file regarding the parameters nature and values
    '''
    filename = "_".join([f"{k}{v}" for k,v in dico.items()])
    return filename


def select_data_subset(df, year, show):
    '''
        Auxialiary function to filter data that will be used to generate the Gantt chart, depending on the user's requirements.
        Selects the desired year and remove data samples when target dates are not available.

        @param year (int): the (only) year to consider on the Gantt chart
        @param show (str): either 
    '''
    # ensure the given argument is correct, otherwise raise value error
    if show not in ['deadlines', 'conf']:
        raise ValueError(f"'show' variable should be either 'deadlines' or 'conf', but is '{show}'.")
    
    # keep only the desired year
    df_selected = df[df['Year'] == year]

    # remove data samples when target dates are not available
    if show == 'conf':
        df_selected = df_selected.dropna(subset=['ConfStarts', 'ConfEnds'])

    elif show == 'deadlines':
        df_selected = df_selected.dropna(subset=['PaperDue', 'NotifOfAcceptance'])

    if df_selected.shape[0] == 0:
        raise RuntimeError(colored(f"The requirements year={year} and show={show} lead to an empty dataset, hence the Gantt chart cannot be generated. Please consider another set of requirements that matches with available data. If needed, you can access the google slides spreadsheet at this URL: https://docs.google.com/spreadsheets/d/1QCnD7HpnaAkYqb4f70uqqmOtZL_IYoAuRRe8AeF6stI/edit#gid=0"))

    return df_selected

