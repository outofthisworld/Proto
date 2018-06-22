var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
const path = require("path");
const { EventEmitter } = require("events");
const emitter = new EventEmitter();
const express=require('express');


app.use(express.static(path.resolve(__dirname, "public")));

/*
    Scaling to multiple servers (clusters)
    Have a list of servers that are allowed to communicate e.g
    servers = [
        [ip,port],
        [ip,port]
    ]
    when a file search is requested we have to reach all sockets,
    even ones that have resolve to a server other than this one
    as such,

    to broadcast: loop through servers requesting they broadcast given data
    to all clients

    to search: ask a specific server if it has a socket connected with a specfic id.

    node cluster API also should be used to improve performance and IPC
    can be done using node I/O or IPC module.

    It might be better to implement the network server under a different process
    and fork/communicate with it via IPC. This allows memory to be handled more efficently
    as well as CPU resouces.
*/
app.get('/search/:file/:id',function(req,res){
    const fileToSearch = req.params.file;
    const socketId = req.params.id;
    console.log('recieved request')
    if(!fileToSearch){
        res.status(300).json({error:'Invalid file name'});
    }else{
        emitter.emit('sendToAll',{
            event:'checkForFile',
            data:{
                searchQuery:fileToSearch,
                id:socketId
            }
        })
        console.log('responding with ok:')
        res.status(200).json({ok:'ok'});
    }
})


app.get('/request/:file/:fileOwner/:requester',function(req,res){
    console.log('rec req for file')
    //The file sha being requested
    const requestedFile = req.params.file;
    //The socket id to send the request to
    const fileOwner = req.params.fileOwner;
    const fileRequester = req.params.requester;
    console.log('recieved request')
    if(!requestedFile){
        res.status(300).json({error:'Invalid file name'});
    }else{
        emitter.emit('sendToOne',{
            id:fileOwner,
            event:'fileRequest',
            data:{
                requestedFile,
                requester:fileRequester
            }
        })
        console.log('responding with ok:')
        res.status(200).json({ok:'ok'});
    }
})

io.on('connection', function(socket){
    console.log('a user connected id:');
    console.log(socket.id)

    /*
        event emitter
    */
    emitter.on('sendToAll',function(msg){
        socket.emit(msg.event,msg.data);
    })

    emitter.on('sendToOne',function(msg){
        if(socket.id == msg.id){
            socket.emit(msg.event,msg.data);
        }
    })

    /*
        Messages
    */
    socket.on('peerOffer',function(data){
        data.offerer = socket.id;
        io.to(data.owner).emit('peerAccept',data)
    })
   
    socket.on('peerAnswer',function(data){
        data.from = socket.id;
        io.to(data.to).emit('peerAnswerAccept',data);
    }) 

    socket.on('candidate',function(candidate){
        io.to(candidate.to).emit('candidate',candidate.candidate)
    });

    socket.on('acceptRequest',function(data){
        io.to(data.id).emit('initiateP2P',{
        })
    });

    socket.on('filesFound',function(data){
        const files = data.files;
        console.log('recieved files found response')
        console.dir(data)
        io.to(data.id).emit('fileQueryResponse',{
            files,
            //This person is the owner of these files
            owner:socket.id
        })
    });

    socket.on('disconnect', function(){
        console.log('user disconnected');
    });
});

http.listen(3100, function(){
  console.log('listening on *:3000');
});
    
