class Tasks {
    constructor(taskdata, user_signed_in, user_id, mission_group){
        this.tasks = this._make_obj(taskdata);
        this.datetimepickerformat = 'MM/DD/YYYY HH:mm';
        this.user_signed_in = user_signed_in;
        this.mission_group = mission_group;
        this.user_id = user_id;
        this.oc = null;
        this.selected_task_id = null;
        this.root_task_id = taskdata['root_task_id'];
        this.options = {
            'pan': true,
            'zoom': true,
            'parentNodeSymbol': false,
            'draggable': mission_group !== "viewer",
            'createNode': function($node, data) {
                if(mission_group !== "viewer"){
                    $node.append('<div class="add-button">+</div>');

                    if(data.level !== 1){
                        $node.append('<div class="delete-button">&times;</div>');
                    }
                }

                if (moment().diff(moment(data.created_at), 'weeks') < 1){
                    $node.append('<div class="new-icon">NEW</div>')
                }

                if(moment(data.deadline_at).isValid() && data.deadline_at !== undefined){
                    let diff = moment().diff(moment(data.deadline_at), 'days');
                    if (diff > 0){
                        $node.children(".title").css({"background-color": "lightgray"});
                    } else if (diff >= -3){
                        $node.children(".title").css({"background-color": "lightpink"});
                    } else if(diff >= -7){
                        $node.children(".title").css({"background-color": "khaki"});
                    } else {
                        $node.children(".title").css({"background-color": "powderblue"});
                    }
                }
            }
        };
    }

    _make_obj(taskdata){
        let task_dic = {};

        for(let task_id in taskdata) {
            if(taskdata.hasOwnProperty(task_id)){
                if(task_id !== "root_task_id"){
                    task_dic[task_id] = {
                        'id' : task_id,
                        'name' : taskdata[task_id]['name'],
                        'description' : taskdata[task_id]['description'],
                        'deadline_at' : taskdata[task_id]['deadline_at'],
                        'created_at' : taskdata[task_id]['created_at'],
                        'status' : taskdata[task_id]['status'],
                        'notify' : taskdata[task_id]['notify'],
                        'participants' : taskdata[task_id]['participants'],
                        'children' : []
                    }
                }
            }
        }

        for(let task_id in taskdata) {
            if(taskdata.hasOwnProperty(task_id)){
                if(task_id !== "root_task_id"){
                    for(let child_task_id of taskdata[task_id]['children']){
                        task_dic[task_id]['children'].push(task_dic[child_task_id]);
                        task_dic[child_task_id]['parent'] = task_dic[task_id];
                    }
                }
            }
        }
        return task_dic;
    }

    make_hierarchy(){
        return this.tasks[this.root_task_id];
    }

    get_task(search_task_id){
        return this.tasks[search_task_id];
    }

    get_selected_task_id(){
        return this.selected_task_id;
    }

    draw(container_id){
        this.options['data'] = this.make_hierarchy();

        this.oc = $(container_id).orgchart(this.options);

        this.oc.$chart.on('nodedrop.orgchart', function(event, extraParams) {
            App.mission.send_change_hierarchy({
                'former_parent_task_id' : extraParams.dragZone.attr('id'),
                'id' : extraParams.draggedNode.attr('id'),
                'latter_parent_task_id' : extraParams.dropZone.attr('id'),
                'user_id' : this.user_id
            });
        });

        $('.orgchart').addClass('noncollapsable');

        let urlParams = new URLSearchParams(location.search);
        if(urlParams.has('taskid')){
            let task_id = urlParams.get('taskid');
            $('#' + task_id).addClass("target_task");
        }
    }

    drawDetailTask(selected_task_id){
        this.selected_task_id = Number(selected_task_id);

        let task = this.get_task(this.selected_task_id);

        $('#DetailTaskID').text(task['id']);
        $('#DetailTaskTitle').val(task['name']);
        $('#DetailTaskDescription').val(task['description']);

        $('#DetailTaskDeadline').val(moment(task['deadline_at']).format(this.datetimepickerformat));

        $('#DetailTaskStatus').val(task['status']);
        $('#DetailTaskNotify').val(task['notify']);
        if (task.notify === 'lod'){
            $('.ccby-license').addClass('ccby-active');
        }
        else {
            $('.ccby-license').removeClass('ccby-active');
        }

        let TaskParticipants = $('#TaskParticipants');
        TaskParticipants.empty();
        let user_participate_flag = false;

        for (let participant_id in task['participants']){
            if(task['participants'].hasOwnProperty(participant_id)){
                if (Number(participant_id) === this.user_id){
                    user_participate_flag = true;
                }
                TaskParticipants.append('<li class="mr-2">' + task['participants'][participant_id] + '</li>');
            }
        }

        if(this.user_signed_in){
            if(user_participate_flag){
                $('#ToParticipate').css('display','none');
                $('#DeleteTaskParticipate').css('display','block');
            }else {
                $('#ToParticipate').css('display','block');
                $('#DeleteTaskParticipate').css('display','none');
            }
        }

        $('#datetimepickerDetailTaskDeadline').datetimepicker(
            {
                format: this.datetimepickerformat,
            }
        );
        $('#DetailTask').modal('show');


        if(lod){
            $('#TaskTags').empty();
            let query =
                "PREFIX mf-task: <" + mf_resource + "tasks/> " +
                "PREFIX tag-ont: <" + tag_ontology + "> " +
                'select ?tags where{' +
                '?annotate tag-ont:target mf-task:' + task['id'] + ' ;' +
                'tag-ont:body ?tags.}';

            $.ajax({
                type: 'GET',
                url: sparql_endpoint,
                data: {
                    'query' : query,
                    'format' : 'application/sparql-results+json',
                    'default-graph-uri' : tag_graph_uri
                },
                success: function(data) {
                    for (let x of data['results']['bindings'] ){
                        let tag_name = x['tags']['value'];
                        $('#TaskTags').append('<li><a href="' + tag_name + '">' + tag_name + '</a></li>');
                    }
                }
            });
        }

    }

    drawAddTask(selected_task_id){
        this.selected_task_id = Number(selected_task_id);
        $('#AddTask').modal('show');
        $('#datetimepickerAddTaskDeadline').datetimepicker(
            {
                format: this.datetimepickerformat,
            }
        );
        $('#AddTaskTitle').val('');
        $('#AddTaskDescription').val('');
        $('#DetailTaskDeadline').val(null);
        $('#AddTaskStatus').val();
        $('#AddTaskNotify').val(this.get_task(this.selected_task_id).notify);
    }

    drawDeleteTask(selected_task_id){
        this.selected_task_id = Number(selected_task_id);

        let task = this.get_task(this.selected_task_id);

        $('#ConfirmDeleteTask').modal('show');
        $('#DeleteTaskTitle').text(task.name);
    }

    update_task(task){
        let update_task = this.get_task(task['id']);

        if(typeof task != null){
            update_task['name'] = task.hasOwnProperty('name') ? task['name'] : update_task['name'];
            update_task['description'] = task.hasOwnProperty('description') ? task['description'] : update_task['description'];
            update_task['deadline_at'] = task.hasOwnProperty('deadline_at') ? task['deadline_at'] : update_task['deadline_at'];
            update_task['status'] = task.hasOwnProperty('status') ? task['status'] : update_task['status'];
            update_task['notify'] = task.hasOwnProperty('notify') ? task['notify'] : update_task['notify'];

            let $title  = $('#' + task['id'] +' .title');
            $title.text(update_task['name']);

            if(moment(update_task['deadline_at']).isValid() && update_task['deadline_at'] !== undefined){
                let diff = moment().diff(moment(update_task['deadline_at']), 'days');
                if (diff > 0){
                    $title.css({"background-color": "lightgray"});
                } else if (diff >= -3){
                    $title.css({"background-color": "lightpink"});
                } else if(diff >= -7){
                    $title.css({"background-color": "khaki"});
                } else {
                    $title.css({"background-color": "powderblue"});
                }
            }else {
                $title.css({"background-color": "white"});
            }
        }
    }

    add_task(task){
        if(this.tasks.hasOwnProperty(task['id'])){
            this.update_task(task);
        }
        else{

            let parent_task = this.get_task(task['parent_task_id']);
            this.tasks[task['id']] = {
                'id' : task['id'],
                'name' : task['name'],
                'description' : task['description'],
                'deadline_at' : task['deadline_at'],
                'created_at' : task['created_at'],
                'status' : task['status'],
                'notify' : task['notify'],
                'participants' : task['participants'],
                'children' : [],
                'parent' : parent_task
            };            
            parent_task['children'].push(this.get_task(task['id']));

            let $parent_task = $('#' + task['parent_task_id']);
            let hasChild = $parent_task.parent().attr('colspan') > 0;

            if(!hasChild){
                this.oc.addChildren($parent_task, [{
                    'id' : task['id'],
                    'name' : task['name'],
                    'deadline_at' : task['deadline_at'],
                    'relationship' : "100"
                }]);
            }else {
                this.oc.addSiblings($parent_task.closest('tr').siblings('.nodes').find('.node:first'), [{
                    'id' : task['id'],
                    'name' : task['name'],
                    'deadline_at' : task['deadline_at'],
                    'relationship' : "110"
                }]);
            }
        }
    }

    delete_task(data){
        let target_task = this.get_task(data.id);
        
        let stack_tasks = [target_task];
        
        while(stack_tasks.length > 0){
            let task = stack_tasks.pop();

            for(let child_task of task['children']){
                stack_tasks.push(child_task);
            }

            delete this.tasks[task['id']];
        }
        
        this.oc.removeNodes($('#' + data.id));
    }

    add_participant(data){
        let target_task = this.get_task(data['task_id']);
        target_task['participants'][data['id']] = data['name'];
    }

    delete_participant(data){
        let target_task = this.get_task(data['task_id']);
        delete target_task['participants'][data['id']];
    }

    change_hierarchy(data){
        let former_parent_task = this.get_task(data['former_parent_task_id']);
        let target_task = this.get_task(data['id']);
        let tmp_delete_idx = former_parent_task['children'].indexOf(target_task);
        former_parent_task['children'].splice(tmp_delete_idx, 1); 

        let latter_parent_task = this.get_task(data['latter_parent_task_id']);
        latter_parent_task['children'].push(target_task);
        target_task['parent'] = latter_parent_task;


        this.oc.removeNodes($('#' + data['id']));

        let $parent_task = $('#' + data['latter_parent_task_id']);
        let hasChild = $parent_task.parent().attr('colspan') > 0;

        if(!hasChild){
            this.oc.addChildren($parent_task, [target_task]);
        }else {
            this.oc.addSiblings($parent_task.closest('tr').siblings('.nodes').find('.node:first'), [target_task]);
        }
    }
}