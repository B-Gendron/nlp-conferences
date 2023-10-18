
# NLP-related conferences Gantt chart generator
This repository proposes a tool that generates Gantt chart from [a google spreadsheet](https://docs.google.com/spreadsheets/d/1QCnD7HpnaAkYqb4f70uqqmOtZL_IYoAuRRe8AeF6stI/edit#gid=0) containing key information about upcoming NLP-related conferences. 

## Overview

This tool allows to visualize either the conferences dates or the associated deadlines (paper submission deadline and notification of acceptance). The user can choose the year to visualize, depending on data availability. Conferences or durations between deadlines are displayed using a specific color code that corresponds to conference ranks according to [CORE2023 ranking](http://portal.core.edu.au/conf-ranks/?search=&by=all&source=CORE2023&sort=atitle&page=1).  

  <figure>
    <img width="1440" alt="Capture d’écran 2023-08-31 à 15 20 40" src="https://github.com/B-Gendron/nlp-conferences/assets/95307996/c134a463-10ec-4058-871b-7d453b2ac02e" style="width:100%">
  </figure>
<p align="center">
<i>Fig. 1 - User interface</i>
</p>

## Usage

First, clone this repo and get inside it:

```
git clone https://github.com/B-Gendron/nlp-conferences.git
cd nlp-conferences
```

### Display conference deadlines (from submission due to notification of acceptance)

```
bash deadlines.sh
```

### Display conference venue dates

```
bash confs.sh
```

After executing one of the scripts above, the HTML output will be displayed on your navigator if you have one currently opened. Anyway, it is saved in the `outputs` directory of the repo.
