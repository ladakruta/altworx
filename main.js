$.extend({
  getUrlVars: function(){
    var vars = [], hash;
    var hashes = window.location.href.slice(window.location.href.indexOf('#') + 1).split('&');
    console.log(hashes);
    for(var i = 0; i < hashes.length; i++)
    {
      hash = hashes[i].split('=');
      vars.push(hash[0]);
      vars[hash[0]] = hash[1];
    }
    return vars;
  },
  getUrlVar: function(name){
    return $.getUrlVars()[name];
  }
});


/**
 * Objekt Mailbox
 * 
 */
var Mailbox = {
    /**
     * Adresa serveru
     * @type String
     */
    serverUrl: 'http://guess.dev.altworx.com',
    /**
     * Složky pro zprávy
     * @type Array
     */
    folders: null,
    /**
     * Zafiltrovaná složka
     * @type Int
     */
    selectedFolder: null,
    /**
     * Všechny zprávy mailboxu
     * @type Array
     */
    messages: null,
    /**
     * Vyfiltrované zprávy
     * @type Array
     */
    filteredMessages: null,
    /**
     * Nastavení filtru zpráv
     * @type Object
     */
    filter: {
        priority: -1,
        isOpen: -1,
        isFavourited: -1
    },
    /**
     * Hláška stavu aplikace
     * @type String
     */
    alert: null,
    /**
     * Je hlášení stavu chybové?
     * @type Boolean
     */
    error: false,
    /**
     * Načte seznam složek ze vzdáleného serveru
     */
    initFolders: function(){
        var folders = null;
        $.ajax({
            url: Mailbox.serverUrl+'/api/folders',
            type: 'GET',
            async: false,
            dataType: 'json',
            success: function(data) { 
                folders = data.folders;
            },
            error: function(data) {
                console.log(data);
            }
        });
        this.folders = folders;
        this.sortList('folders','order');
    },
    /**
     * Načte zprávy ze vzdáleného serveru
     */
    initMessages: function(){
        var messages = null;
        $.ajax({
            url: Mailbox.serverUrl+'/api/messages'+(this.selectedFolder?'?folder='+this.selectedFolder:''),
            type: 'GET',
            async: false,
            dataType: 'json',
            success: function(data) { 
                messages = data;
            },
            error: function(data) {
                console.log(data);
            }
        });
        this.messages = messages.messages;
        this.filteredMessages = this.messages;
        this.lastUpdate = messages.lastUpdate;
        this.sortList('messages','sendDate', true);

    },
    /**
     * Vypíše hlášku o stavu apikace
     * @param {String} messageText
     * @param {Boolean} isError
     */
    showAlert: function(messageText, isError){
        $('#alert').html(messageText);
        if(isError){
            $('#alert').addClass('error');
        }
        else{
            $('#alert').removeClass('error');
        }
        $('#alert').show();
    },
    /**
     * Skryje element s hláškou
     */
    hideAlert: function(){
       $('#alert').hide(); 
    },
    /**
     * Vypíše složky zpráv v aplikaci
     */
    loadFolders: function(){
        this.initFolders();

        $('ul.folders li');
        $.each(this.folders, function(i, folder){
            if(folder.name===null){
                folder.name = 'No name';    
            }
            var li = $('<li />')
                    .addClass((i%2)?'even':'odd')
                    .addClass(folder.hasUnopened?'has-unopened':'')   
                    .attr('data-id', folder.id)
            ;
            var a = $('<a />')
                    .attr('href', '#folder='+folder.id)
                    .append(folder.name + ' (<span class="count">' + folder.messageCount + '</span>)')
            ;             
           li.append(a);
            $('ul.folders').append(li);
        }); 
        
        this.listenFolders();
    },
    /**
     * Vypíše seznam zpráv
     * @param {Boolean} doNotInit nenačítat znovu ze serveru
     */
    loadMessages: function(doNotInit){
        this.alert = null;    
        this.showAlert('Loading messages...');
        if(doNotInit !== true){
            this.initMessages();    
        }
        $('table.messages tr:not(.head)').remove();
        $.each(this.filteredMessages, function(i, message){
            var tr = $('<tr />')
                    .addClass((i%2)?'even':'odd')
                    .addClass('header')
                    .attr('data-id', message.id)
                    .attr('data-index', i)
            ;
            var trBody = $('<tr />')
                    .addClass((i%2)?'even':'odd')
                    .addClass('body')
            ;
            tr.append('<td class="priority">' + message.priority + '</td>');
            tr.append('<td class="is-open">' 
                        + '<input type="checkbox" disabled="true" ' + (message.isOpen?'checked="true"':'') + '>'
                    + '</td>'
            );
            tr.append('<td class="is-favourited">' 
                        + '<input type="checkbox" ' + (message.isFavourited?'checked="true"':'') + '>'
                    + '</td>'
            );
            tr.append('<td class="sender">' + message.sender + '</td>');
            tr.append('<td class="subject">' + message.subject + '</td>');
            tr.append('<td class="send-date">' + Mailbox.dateFormat(message.sendDate) + '</td>');
            trBody.append('<td colspan="6">' + message.body + '</td>');
            $('table.messages').append(tr).append(trBody);
        });
        if(!this.filteredMessages.length && this.messages.length>0){
            this.alert = 'No item matches filter criteria. Change filter settings.';
        }
        if(!this.messages.length){
            this.alert = 'You have no messages';
        }
        this.hideAlert();
        if(this.alert){
            this.showAlert(this.alert, this.error);
        } 
        this.listenMessages();
        Statistics.showPriorityGraph();
        
    },
    /**
     * Vypíše složky a seznam zpráv
     */
    load: function(){
        this.error = false;
        this.showAlert('Loading messages...');
        this.loadFolders();
        this.loadMessages();
        this.hideAlert();
        if(this.alert){
            this.showAlert(this.alert, this.error);
        } 

    },
    /**
     * Nabinduje listenery elementů složek
     */
    listenFolders: function(){
        $('ul.folders li').click(function(){
            $('ul.folders li').removeClass('selected');    
            Mailbox.selectedFolder = $(this).data('id');
            Mailbox.loadMessages();
            $(this).addClass('selected');
            $('.filter :input').change();
        });    
    },
    /**
     * Nabinduje listenery elementů zpráv
     */
    listenMessages: function(){
        //open message
        $('table.messages tr.header td:not(.is-favourited)').click(function(){
            Mailbox.hideAlert();
            if($(this).parent('tr').next('tr.body').find('td').is(':visible')){
                $(this).parent('tr').next('tr.body').find('td').hide();
            }
            else{
                $('table.messages tr.body td').hide();
                $(this).parent('tr').next('tr.body').find('td').show();  
                if(!$(this).parent('tr').find('td.is-open :input').is(':checked')){
                   $(this).parent('tr').find('td.is-open :input').attr('checked',true);
                   Mailbox.updateMessage($(this).parent('tr').data('id'), 'isOpen', true);
                }
            }  
        });
        
        //mark message as favourited
        $('table.messages td.is-favourited :input').change(function(){
            if($(this).is(':checked')){ 
                Mailbox.updateMessage($(this).parents('tr').data('id'), 'isFavourited', true); 
            }
            else{
                Mailbox.updateMessage($(this).parents('tr').data('id'), 'isFavourited', false); 
            }
        });
    },
    /**
     * Seřadí zprávy nebo složky podle atributu
     * @param {String} propertyName zpráva/složka ...
     * @param {String} sortBy atribut, podle kterého se mají řadit objekty
     * @param {Boolean} desc sestupně?
     */
    sortList: function(propertyName, sortBy, desc){
        //http://stackoverflow.com/questions/5503900/
        this[propertyName].sort(function(a, b){
            var a1= a[sortBy], b1= b[sortBy];
            if(a1=== b1){
                return 0;    
            } 
            if(desc){
                return a1 < b1 ? 1 : -1;    
            }
            return a1 > b1 ? 1 : -1;
        });
    },
    /**
     * Human-readable formát datumu
     * @param {String} str
     * @returns {String}
     */
    dateFormat: function(str){
        var timestamp = Date.parse(str);
        var d = new Date(timestamp);
        
        //http://stackoverflow.com/questions/3066586
        var yyyy = d.getFullYear();
        var mm = d.getMonth() < 9 ? "0" + (d.getMonth() + 1) : (d.getMonth() + 1); // getMonth() is zero-based
        var dd  = d.getDate() < 10 ? "0" + d.getDate() : d.getDate();
        var hh = d.getHours() < 10 ? "0" + d.getHours() : d.getHours();
        var min = d.getMinutes() < 10 ? "0" + d.getMinutes() : d.getMinutes();
        var ss = d.getSeconds() < 10 ? "0" + d.getSeconds() : d.getSeconds();
        return dd+'.'+mm+'.'+yyyy+' '+hh+':'+min+':'+ss;

    },
    /**
     * Vrátí objekt zprávy s daným ID
     * @param {Int} id
     * @returns {Object}
     */
    getMsgObjectById: function(id){
        $.each(this.messages, function(msg){
            if(msg.id===id){
                return msg;
            }
        });
        return null;
    },
    /**
     * Update zprávy a vložení změny na server
     * @param {Int} id ID zprávy
     * @param {String} propertyName název změněmého atributu
     * @param {String} propertyValue hodnota změněného atributu
     */
    updateMessage: function(id, propertyName, propertyValue){
        
        $.each(this.messages, function(i, msg){
            if(msg.id===id){
                Mailbox.messages[i][propertyName] = propertyValue;
            }
        });
        
        $.each(this.filteredMessages, function(i, msg){
            if(msg.id===id){
                Mailbox.filteredMessages[i][propertyName] = propertyValue;
            }
        });
        
        $.ajax({
            url: Mailbox.serverUrl+'/api/messages/'+id,
            type: 'PUT',
            async: false,
            dataType: 'json',
            data: Mailbox.getMsgObjectById(id),
            //data: JSON.stringify(Mailbox.getMsgObjectById(id)),
            success: function(data) { 
                this.showAlert('Message was successfully updated on remote server. ' + data.statusText);
            },
            error: function(data){
                console.log(data);
                Mailbox.showAlert('Message update failure:<br />' + data.statusText,true);
                console.log(Mailbox.messages);
                console.log(Mailbox.filteredMessages);
            }
        });
     
    },
    /**
     * Vyfiltruje zprávy dle zvolených atributů
     * @param {String} byProperty Právě změněný parametr
     * @param {Mixed} value Hodnota právě změněného atributu 
     */
    filterMessages: function(byProperty, value){
        if(byProperty){
            this.filter[byProperty] = value;    
        }
        this.filteredMessages = [];
        
        $.each(this.messages, function(i, msg){
            var isAllowedByFilter = true;
            $.each(Mailbox.filter, function(prop, val){
                if(val==1){
                    val=true;
                }
                if(val==0){
                    val=false;
                }
                if(msg[prop]==val || val==-1){
                    isAllowedByFilter *= true;    
                }
                else{
                    isAllowedByFilter *= false;
                }  
            });
            if(isAllowedByFilter){
                Mailbox.filteredMessages.push(msg);
            }
            isAllowedByFilter = true;
        });
        
    },
    /**
     * Vrátí počet vyfiltrovaných zpráv s danou prioritou
     * @param {String} priority
     * @returns {Number}
     */
    countMessagesHavingPriority: function(priority){
        var count = 0;
        $.each(this.filteredMessages, function(i, msg){
            if(msg.priority === priority){
                count++;
            }
        });   
        return count;
    }
    
};


/**
 * Objekt pro generování grafů
 * 
 */
var Statistics = {
    /**
     * Vypíše graf poměru zpráv dle urgentnosti
     */
    showPriorityGraph: function(){
        $('#chart1').html(null);
   
        //./libraries/jqplot/examples/barTest.html
        $.jqplot.config.enablePlugins = true;
        var s1 = [
             Mailbox.countMessagesHavingPriority('urgent')
            ,Mailbox.countMessagesHavingPriority('high')
            ,Mailbox.countMessagesHavingPriority('low')
        ];      
        var ticks = ['urgent', 'high', 'low'];

        plot1 = $.jqplot('chart1', [s1], {
            // Only animate if we're not using excanvas (not in IE 7 or IE 8)..
            animate: !$.jqplot.use_excanvas,
            seriesDefaults:{
                renderer:$.jqplot.BarRenderer,
                pointLabels: { show: true }
            },
            axes: {
                xaxis: {
                    renderer: $.jqplot.CategoryAxisRenderer,
                    ticks: ticks
                }
            },
            highlighter: { show: false }
        });

        $('#chart1').bind('jqplotDataClick', 
            function (ev, seriesIndex, pointIndex, data) {
                $('#info1').html('series: '+seriesIndex+', point: '+pointIndex+', data: '+data);
            }
        );
    }
    
};


/**
 * READY
 * 
 */
$().ready(function(){ 
    
    var selectedFolder = $.getUrlVar('folder');
    if(selectedFolder){
        Mailbox.selectedFolder = selectedFolder;
    }

    Mailbox.load();
    //console.log(Mailbox.folders);
    //console.log(Mailbox.messages);
    
    //řazení výpisu zpráv
    $('table.messages th').click(function(){
        var desc = false;
        if($(this).hasClass('asc')){
            $(this).removeClass('asc');
            $(this).addClass('desc');
            desc = true;
        }
        else{
            $(this).removeClass('desc');
            $(this).addClass('asc');
        }
        $(this).siblings('th').removeClass('desc').removeClass('asc');
        Mailbox.sortList('filteredMessages', $(this).data('property'), desc);
        Mailbox.loadMessages(true);
    });
    
    //filtrování zpráv
    $('.filter :input').change(function(){
        Mailbox.filterMessages($(this).data('property'), $(this).val());
        Mailbox.loadMessages(true);
    })
    .change()
    ;
    
    Statistics.showPriorityGraph();

});
