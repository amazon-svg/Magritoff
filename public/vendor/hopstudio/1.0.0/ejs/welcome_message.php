<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Pac/<./>uilders</title>
    <meta name="description" content="Online Design to Cost packaging marketplace">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="icon" href="cropped-favicon_xl-32x32.png" sizes="32x32">

    <script type="text/javascript" src="https://headless.clariprint.com/node_modules/crypto-js/crypto-js.js"></script>
    <script type="text/javascript" src="https://headless.clariprint.com/node_modules/jquery/dist/jquery.min.js"></script>
    <script type="text/javascript" src="https://headless.clariprint.com/node_modules/jquery-ui/dist/jquery-ui.js"></script>

    <script type="module" src="https://headless.clariprint.com/node_modules/@popperjs/core/dist/esm/popper-lite.js"></script>
    <script src="https://headless.clariprint.com/node_modules/bootstrap/dist/js/bootstrap.bundle.min.js"></script>

    <script type="text/javascript" src="https://headless.clariprint.com/node_modules/bootstrap5-toggle/js/bootstrap5-toggle.jquery.min.js"></script>
    <script type="module" src="https://headless.clariprint.com/node_modules/@melloware/coloris/dist/esm/coloris.min.js"></script>
    <script type="text/javascript" src="https://headless.clariprint.com/node_modules/ejs/ejs.min.js"></script>
    <script type="text/javascript" src="https://headless.clariprint.com/node_modules/jszip/dist/jszip.min.js"></script>
    <script type="text/javascript" src="https://headless.clariprint.com/node_modules/browser-image-resizer/dist/index.js"></script>
    <script type="text/javascript" src="https://headless.clariprint.com/node_modules/jspdf/dist/jspdf.umd.js"></script>
    <script type="text/javascript" src="https://headless.clariprint.com/node_modules/gl-matrix/gl-matrix-min.js"></script>


    <script src="https://headless.clariprint.com/js/sugarcrepeHLUX.js"></script>
    <script src="https://headless.clariprint.com/js/xl_3D_sampler.js"></script>

    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
     integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
     crossorigin=""></script>

    <script src="https://headless.clariprint.com/js/partners.js"></script>
 
    <!-- STYLES -->

    <link href="https://headless.clariprint.com/node_modules/jquery-ui/dist/themes/base/jquery-ui.css" rel="stylesheet">
    <link href="https://headless.clariprint.com/node_modules/bootstrap/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://headless.clariprint.com/node_modules/bootstrap5-toggle/css/bootstrap5-toggle.min.css" rel="stylesheet">

    <link rel="stylesheet" href="https://headless.clariprint.com/node_modules/bootstrap-select/dist/css/bootstrap-select.min.css">

    <link href="https://headless.clariprint.com/node_modules/@melloware/coloris/dist/coloris.min.css" rel="stylesheet">

    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
     integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
     crossorigin=""/>


    <link href="https://vjs.zencdn.net/8.6.0/video-js.css" rel="stylesheet" />
    
    <style {csp-style-nonce}>
    /*    * {
            transition: background-color 300ms ease, color 300ms ease;
        }
        *:focus {
            background-color: rgba(221, 72, 20, .2);
            outline: none;
        } */
        html, body {
            color: rgba(33, 37, 41, 1);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
            font-size: 16px;
            margin: 0;
            padding: 0!important;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            text-rendering: optimizeLegibility;
        }
        
        _header:before {
            content: "";
              position: absolute;
              top: 0; left: 0;
              width: 100%; height: 80%;
            background-color: transparent!important;
            background-image: url("/img/black_shelter.png");
            filter : contrast(40%) brightness(70%) invert(20%); 
            background-repeat: no-repeat;
            background-position: -400px -60px; 
            background-size: auto 750px;             
        }

        header {
            zbackground-color: rgba(247, 248, 249, 1);
            background-color: #343a40FF!important;
            
         /*   padding: .4rem .4rem .4rem .4rem; */
            font-size: 20px;
            color: white;
        }
        .navbar {
            padding: .2rem 1rem; 
        }

        .userlink {
            font-size: 14px;
        }

        span.navbar-collapse {
            padding: 0;
            flex-direction: row-reverse;
        }

        header ul {
            border-bottom: 0px solid rgba(242, 242, 242, 1);
            list-style-type: none;
            margin: 0;
          /*  overflow: hidden; */
            padding: 0;
            text-align: right;
        }
        header li {
            display: inline-block;
        }
        header li a, .freetry {
            border-radius: 5px;
            color: rgba(0, 0, 0, .5);
            display: block;
            margin: 5px 0;
            height: 38px;
            line-height: 36px;
            padding: .4rem .65rem;
            text-align: center;
            text-decoration: none;
            color: white;
            font-size: .9375rem;
            font-weight: 700;
            font-family: Slack-Circular-Pro,"Helvetica Neue",Helvetica,"Segoe UI",Tahoma,Arial,sans-serif;
            white-space: nowrap;
        }
        .freetry {
            color: black;
            height: 45px;
        }
/*        header li.nav-item a {
            border-radius: 5px;
            margin: 5px 0;
            height: 38px;
            line-height: 36px;
            padding: .4rem .65rem;
            text-align: center;
        } */
        .freetry:hover,
        .freetry:focus,
        header li.nav-item a:hover,
        header li.nav-item a:focus {
           /* background-color: rgba(221, 72, 20, .2);
            color: rgba(221, 72, 20, 1); */
            color: green;
            height: 45px;
        } 
        header .logo {
            float: left;
            height: 44px;
            padding: .4rem .5rem;
        }
        header .menu-toggle {
            display: none;
            float: right;
            font-size: 2rem;
            font-weight: bold;
        }
        header .menu-toggle button {
            background-color: rgba(221, 72, 20, .6);
            border: none;
            border-radius: 3px;
            color: rgba(255, 255, 255, 1);
            cursor: pointer;
            font: inherit;
            font-size: 1.3rem;
            height: 36px;
            padding: 0;
            margin: 11px 0;
            overflow: visible;
            width: 40px;
        }
        header .menu-toggle button:hover,
        header .menu-toggle button:focus {
            background-color: rgba(221, 72, 20, .8);
            color: rgba(255, 255, 255, .8);
        }
        header .heroe {
            margin: 0 auto;
            max-width: 1100px;
            padding: 1rem 1.75rem 1.75rem 1.75rem;
        }
        header .heroe h1 {
            font-size: 2.5rem;
            font-weight: 500;
        }
        header .heroe h2 {
            font-size: 1.5rem;
            font-weight: 300;
        }
        section {
            background-color: white!important; /* #444a50!important; */
            margin: 0;
         /*   max-width: 1100px; */
            padding: 0;
            _padding: 1.75rem 1.0rem 3.5rem 1.0rem;
        }
        section h1 {
            margin-bottom: 2.5rem;
        }
        section h2 {
            font-size: 120%;
            line-height: 2.5rem;
            padding-top: 1.5rem;
        }
        section pre {
            background-color: rgba(247, 248, 249, 1);
            border: 1px solid rgba(242, 242, 242, 1);
            display: block;
            font-size: .9rem;
            margin: 2rem 0;
            padding: 1rem 1.5rem;
            white-space: pre-wrap;
            word-break: break-all;
        }
        section code {
            display: block;
        }
        section a {
        /*    color: rgba(221, 72, 20, 1); */
        }
        section svg {
            margin-bottom: -5px;
            margin-right: 5px;
            width: 25px;
        }
        .further {
            background-color: rgba(247, 248, 249, 1);
            border-bottom: 1px solid rgba(242, 242, 242, 1);
            border-top: 1px solid rgba(242, 242, 242, 1);
        }
        .further h2:first-of-type {
            padding-top: 0;
        }
        table {
            color: inherit!important;
        }

        footer {
            position: sticky;
            z-index: 10;
            background-color: #343a40!important;
            text-align: center;
            padding-top: 2rem;
        }
        footer .environment {
            color: rgba(255, 255, 255, 1);
            padding: 2rem 1.75rem;
        }
        footer .copyrights {
            background-color: rgba(62, 62, 62, 1);
            color: rgba(200, 200, 200, 1);
            padding: .25rem 1.75rem;
        }

        footer section {
            background-color: #e4f0e4!important;
            padding-top: 2em;
            padding-bottom: 2em;
            padding-right: 0.5em;
            padding-left: 0.5em;
        }


        footer .content-container {
            display:flex;
            flex-wrap: inherit; 
            align-content: center;
        }
        
        footer section h1 {
            font-weight:700; 
            font-size:2.0rem;
        }
        footer section h5 {
            font-weight:400; 
            font-size:1.2rem;
        }

        @media (max-width: 629px) {
            header ul {
                padding: 0;
            }
            header .menu-toggle {
                padding: 0 1rem;
            }
            header .menu-item {
                background-color: rgba(244, 245, 246, 1);
                border-top: 1px solid rgba(242, 242, 242, 1);
                margin: 0 15px;
                width: calc(100% - 30px);
            }
            header .menu-toggle {
                display: block;
            }
            header .hidden {
                display: none;
            }
            header li.menu-item a {
                background-color: rgba(221, 72, 20, .1);
            }
            header li.menu-item a:hover,
            header li.menu-item a:focus {
                background-color: rgba(221, 72, 20, .7);
                color: rgba(255, 255, 255, .8);
            }
        }
        img.leaflet-tile {
            filter: grayscale(0.3) sepia(0.1) contrast(95%) brightness(105%);
        }
        img.leaflet-marker-icon {
            filter: drop-shadow(3px -3px #0002);
        }
    </style>
</head>
<body>
<?php if ($usermail === "adminqyp@clariprint.com") { ?>
<script type="text/javascript">
    
function gTransl(exp,local_source,local_target,todo,error){
    const ajax_request = {
                "url" : `https://translation.googleapis.com/language/translate/v2`,
                "type" : "POST",
                crossDomain: true,
                "dataType" : 'json',
                data : {
                    q: exp,
                    source:local_source,
                    target:local_target,
                    key:"AIzaSyDwyO3UHaeZBSKr6nLzcqcHF2q2g8sm8qg"
                },
                "success" : todo,
                "error" : error
            }
    $.ajax(ajax_request);
}

</script>
<?php } ?>
<!-- HEADER: MENU + HEROE SECTION -->
<header>
    <nav class="mainbar navbar navbar-expand-md navbar-dark bg-dark sticky-top flex p-1 w-100 mx-auto">
<span align="right" class="start px-2 pt-1 pb-1 w-25" style="min-width:280px;">
                    <a href="/">
    <!--                        <svg id="Calque_2" data-name="Calque 2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 780 70" style="width: 280px;"  height="40">
  <title>quoteyourpack</title>
  <g>
    <path d="M235.9741,279.1074a17.9149,17.9149,0,0,1-12.7383-8.5346q-4.2033-6.9631-4.2036-19.1075a42.8206,42.8206,0,0,1,1.7622-13.0141,25.9048,25.9048,0,0,1,4.8409-9.0865,19.4841,19.4841,0,0,1,7.2182-5.35,22.3746,22.3746,0,0,1,8.853-1.7622q10.9549,0,16.4747,7.2183t5.52,20.8481a45.483,45.483,0,0,1-1.3164,11.5069,28.02,28.02,0,0,1-3.7154,8.5771,20.1169,20.1169,0,0,1-12.7592,8.7046,9.6056,9.6056,0,0,0,1.125,3.354,6.5148,6.5148,0,0,0,4.2251,3.1421,11.5615,11.5615,0,0,0,2.6323.2974,9.2462,9.2462,0,0,0,3.63-.7642,10.9306,10.9306,0,0,0,3.2486-2.123l4.7978,7.1333a19.91,19.91,0,0,1-5.8383,3.4394,17.9417,17.9417,0,0,1-6.3477,1.189,25.28,25.28,0,0,1-7.1548-.9341,14.2958,14.2958,0,0,1-5.3926-2.8662,12.94,12.94,0,0,1-3.46-4.8833A20.3064,20.3064,0,0,1,235.9741,279.1074Zm16.687-27.897q0-9.85-2.59-14.6914t-8.5347-4.84a10.18,10.18,0,0,0-5.18,1.2525,9.749,9.749,0,0,0-3.5668,3.6943,18.9309,18.9309,0,0,0-2.0591,5.9868,44.5673,44.5673,0,0,0-.6582,8.0889q0,9.7661,2.6538,14.6489t8.6406,4.8828a10.0609,10.0609,0,0,0,5.1592-1.2524,9.5453,9.5453,0,0,0,3.5029-3.6729,19.0521,19.0521,0,0,0,1.9956-5.9658A46.3431,46.3431,0,0,0,252.6611,251.21Z" transform="translate(-219.0322 -218.6855)" style="fill: #fff"/>
    <path d="M281.45,235.5425v28.1089a8.9957,8.9957,0,0,0,1.3159,5.3291,4.6146,4.6146,0,0,0,3.9912,1.8047,7.4392,7.4392,0,0,0,4.9893-2.1446,37.5662,37.5662,0,0,0,5.0742-5.7959V235.5425h10.36v43.14h-8.959l-.2549-6.3691a35.9951,35.9951,0,0,1-2.76,3.0146,15.7932,15.7932,0,0,1-3.0356,2.314,14.8081,14.8081,0,0,1-3.5669,1.4863,16.1028,16.1028,0,0,1-4.2671.5308,14.4075,14.4075,0,0,1-5.7959-1.0825,10.9975,10.9975,0,0,1-4.14-3.0787,13.3344,13.3344,0,0,1-2.4839-4.7768,21.7716,21.7716,0,0,1-.8281-6.22V235.5425Z" transform="translate(-219.0322 -218.6855)" style="fill: #fff"/>
    <path d="M357.8364,256.7729a28.689,28.689,0,0,1-1.4433,9.32,20.63,20.63,0,0,1-4.1612,7.2392,18.4321,18.4321,0,0,1-6.6665,4.6709,23.0967,23.0967,0,0,1-9.0014,1.6558,24.5406,24.5406,0,0,1-8.5772-1.4014,16.6494,16.6494,0,0,1-6.4116-4.1821,18.5037,18.5037,0,0,1-4.0337-6.9634,30.6981,30.6981,0,0,1-1.4014-9.7451,28.2473,28.2473,0,0,1,1.4649-9.3413,20.295,20.295,0,0,1,4.2036-7.1758,18.6686,18.6686,0,0,1,6.6875-4.6069,23.1332,23.1332,0,0,1,8.917-1.6348,24.3678,24.3678,0,0,1,8.62,1.4224,16.7606,16.7606,0,0,1,6.4111,4.2251,18.5347,18.5347,0,0,1,4.0127,6.9423A30.29,30.29,0,0,1,357.8364,256.7729Zm-10.7846.2549q0-6.7089-2.5269-10.0844a8.7231,8.7231,0,0,0-7.4517-3.3755,9.4028,9.4028,0,0,0-4.6284,1.0615,8.96,8.96,0,0,0-3.1421,2.9082,13.0011,13.0011,0,0,0-1.8042,4.31,23.17,23.17,0,0,0-.5732,5.2651q0,6.7507,2.7173,10.1689a8.9779,8.9779,0,0,0,7.4306,3.4185,9.2715,9.2715,0,0,0,4.501-1.0405,8.4249,8.4249,0,0,0,3.1-2.8872,13.9272,13.9272,0,0,0,1.7832-4.3521A23.33,23.33,0,0,0,347.0518,257.0278Z" transform="translate(-219.0322 -218.6855)" style="fill: #fff"/>
    <path d="M402.3774,278.2578q-2.8022.6372-5.6469,1.0191a40.5831,40.5831,0,0,1-5.3926.3823,26.5293,26.5293,0,0,1-7.3247-.8916,12.7332,12.7332,0,0,1-5.0952-2.7173,10.8013,10.8013,0,0,1-2.9722-4.65,21.0786,21.0786,0,0,1-.9551-6.73V243.61H363.3989v-8.0679h11.5918v-11.04l10.6148-2.76v13.8h16.7719V243.61H385.6055v20.2958a8.1033,8.1033,0,0,0,1.6987,5.5835q1.6977,1.89,5.69,1.89a28.64,28.64,0,0,0,4.9682-.4248q2.42-.4233,4.4155-.9766Z" transform="translate(-219.0322 -218.6855)" style="fill: #fff"/>
    <path d="M452.1836,253.8008q0,1.062-.0635,2.76-.0637,1.6994-.1909,3.1846H423.5654a13.3683,13.3683,0,0,0,.87,5.01,9.8291,9.8291,0,0,0,2.4629,3.63,10.684,10.684,0,0,0,3.8213,2.23,15.1872,15.1872,0,0,0,4.9468.7642,50.03,50.03,0,0,0,6.73-.4883,53.2563,53.2563,0,0,0,7.4521-1.5923v8.2373q-1.656.468-3.6093.8492t-3.9913.68q-2.0382.2967-4.1186.4458t-4.0337.1485a26.0321,26.0321,0,0,1-8.832-1.4014,17.5,17.5,0,0,1-6.6236-4.14,18.1157,18.1157,0,0,1-4.1616-6.7725,27.6741,27.6741,0,0,1-1.4433-9.3413,30.0218,30.0218,0,0,1,1.4433-9.5752,21.9446,21.9446,0,0,1,4.0767-7.3882,17.8949,17.8949,0,0,1,6.39-4.7554,20.3611,20.3611,0,0,1,8.3858-1.6772,21.5547,21.5547,0,0,1,8.11,1.4224,16.2782,16.2782,0,0,1,5.9019,3.97,17.0016,17.0016,0,0,1,3.6093,6.0718A23.3058,23.3058,0,0,1,452.1836,253.8008Zm-10.53-1.4863a12.5081,12.5081,0,0,0-.6372-4.4371,8.8,8.8,0,0,0-1.8472-3.1211,7.3326,7.3326,0,0,0-2.7173-1.8256,9.2346,9.2346,0,0,0-3.333-.5943,8.4935,8.4935,0,0,0-6.4116,2.6114,11.9832,11.9832,0,0,0-2.9721,7.3667Z" transform="translate(-219.0322 -218.6855)" style="fill: #fff"/>
    <path d="M485.6006,259.0234v19.6592H474.9854V259.1084L456.94,223.1865h11.5918l8.1524,17.1543,3.7363,8.4072,3.7368-8.6621,8.5342-16.8994h11.125Z" transform="translate(-219.0322 -218.6855)" style="fill: #fff"/>
    <path d="M549.0791,256.7729a28.6863,28.6863,0,0,1-1.4434,9.32,20.6356,20.6356,0,0,1-4.1611,7.2392,18.44,18.44,0,0,1-6.666,4.6709,23.0994,23.0994,0,0,1-9.002,1.6558,24.538,24.538,0,0,1-8.5771-1.4014,16.6363,16.6363,0,0,1-6.4111-4.1821,18.5045,18.5045,0,0,1-4.0342-6.9634,30.6839,30.6839,0,0,1-1.4014-9.7451,28.2473,28.2473,0,0,1,1.4649-9.3413,20.3015,20.3015,0,0,1,4.2031-7.1758,18.6765,18.6765,0,0,1,6.6875-4.6069,23.1365,23.1365,0,0,1,8.9179-1.6348,24.3651,24.3651,0,0,1,8.6192,1.4224,16.7545,16.7545,0,0,1,6.4111,4.2251,18.528,18.528,0,0,1,4.0127,6.9423A30.2784,30.2784,0,0,1,549.0791,256.7729Zm-10.7842.2549q0-6.7089-2.5273-10.0844-2.5254-3.3757-7.4512-3.3755a9.4018,9.4018,0,0,0-4.6289,1.0615,8.966,8.966,0,0,0-3.1426,2.9082,13.0193,13.0193,0,0,0-1.8037,4.31,23.1983,23.1983,0,0,0-.5732,5.2651q0,6.7507,2.7168,10.1689a8.98,8.98,0,0,0,7.4316,3.4185,9.2661,9.2661,0,0,0,4.5-1.0405,8.4218,8.4218,0,0,0,3.1-2.8872,13.9035,13.9035,0,0,0,1.7832-4.3521A23.302,23.302,0,0,0,538.2949,257.0278Z" transform="translate(-219.0322 -218.6855)" style="fill: #fff"/>
    <path d="M568.3145,235.5425v28.1089a8.9922,8.9922,0,0,0,1.3154,5.3291,4.615,4.615,0,0,0,3.9912,1.8047,7.4394,7.4394,0,0,0,4.9893-2.1446,37.5928,37.5928,0,0,0,5.0742-5.7959V235.5425h10.36v43.14h-8.959l-.2548-6.3691a35.9131,35.9131,0,0,1-2.7608,3.0146,15.7655,15.7655,0,0,1-3.0351,2.314,14.8145,14.8145,0,0,1-3.5664,1.4863,16.11,16.11,0,0,1-4.2676.5308,14.4055,14.4055,0,0,1-5.7959-1.0825,10.9914,10.9914,0,0,1-4.14-3.0787,13.3368,13.3368,0,0,1-2.4844-4.7768,21.7751,21.7751,0,0,1-.8281-6.22V235.5425Z" transform="translate(-219.0322 -218.6855)" style="fill: #fff"/>
    <path d="M633.6191,252.3145a19.12,19.12,0,0,0-.2343-4.1187,7.9393,7.9393,0,0,0-1.0186-2.8022,4.3489,4.3489,0,0,0-1.72-1.6138,5.1626,5.1626,0,0,0-2.336-.5093,7.8105,7.8105,0,0,0-4.7343,1.89,27.24,27.24,0,0,0-5.3711,6.22v27.3022H607.59v-43.14h9.3848l.3809,6.2842a17.0823,17.0823,0,0,1,2.4-2.9722,14.9816,14.9816,0,0,1,2.9716-2.2715,13.997,13.997,0,0,1,3.63-1.4648,17.6474,17.6474,0,0,1,4.374-.51,14.1215,14.1215,0,0,1,5.7959,1.1255,10.9678,10.9678,0,0,1,4.2461,3.333,14.6608,14.6608,0,0,1,2.5479,5.541,28.6769,28.6769,0,0,1,.7,7.7066Z" transform="translate(-219.0322 -218.6855)" style="fill: #fff"/>
    <path d="M692.002,240.85a21.7,21.7,0,0,1-1.4434,8.0039,17.2833,17.2833,0,0,1-4.2891,6.3477,19.6671,19.6671,0,0,1-7.0908,4.1611,29.7807,29.7807,0,0,1-9.8506,1.4863h-5.3076v17.8335H653.49V223.1865H669.752a35.25,35.25,0,0,1,9.5332,1.1675,19.562,19.562,0,0,1,6.9628,3.4185,14.5594,14.5594,0,0,1,4.2891,5.541A18.3621,18.3621,0,0,1,692.002,240.85Zm-10.9551.7217a11.0133,11.0133,0,0,0-.7-4.0122,7.9258,7.9258,0,0,0-2.1231-3.0786,9.6143,9.6143,0,0,0-3.5879-1.9532,17.268,17.268,0,0,0-5.1377-.6792h-5.4775V252.187h5.8164a14.2375,14.2375,0,0,0,4.7988-.7427,9.434,9.434,0,0,0,3.503-2.1445,9.2627,9.2627,0,0,0,2.165-3.3545A12.2238,12.2238,0,0,0,681.0469,241.5718Z" transform="translate(-219.0322 -218.6855)" style="fill: #fff"/>
    <path d="M728.5176,278.6826l-.2549-5.6474a29.3517,29.3517,0,0,1-2.8447,2.6538,17.4467,17.4467,0,0,1-7.1543,3.4819,20.3838,20.3838,0,0,1-4.6075.4883,15.9535,15.9535,0,0,1-5.8164-.9766,11.7164,11.7164,0,0,1-4.2041-2.7173,11.3156,11.3156,0,0,1-2.5683-4.2036,16.1934,16.1934,0,0,1-.8711-5.435,12.4521,12.4521,0,0,1,1.2949-5.6475,12.0411,12.0411,0,0,1,3.9492-4.4585,20.7371,20.7371,0,0,1,6.6241-2.93,36.3514,36.3514,0,0,1,9.32-1.0615h5.6464v-2.59a9.0359,9.0359,0,0,0-.4667-2.9936,5.3958,5.3958,0,0,0-1.5069-2.2715,7.11,7.11,0,0,0-2.6963-1.4438,14.0253,14.0253,0,0,0-4.0761-.5093,32.97,32.97,0,0,0-7.5372.87,39.244,39.244,0,0,0-7.1972,2.4414v-8.28a41.3237,41.3237,0,0,1,7.1553-2.0381,43.1416,43.1416,0,0,1,8.4277-.8066,32.4515,32.4515,0,0,1,8.2373.9131A14.8333,14.8333,0,0,1,733.04,238.26a10.8768,10.8768,0,0,1,3.2911,4.5644,17.6417,17.6417,0,0,1,1.0615,6.39v29.4678Zm-1.4864-19.0649h-6.3261a16.7865,16.7865,0,0,0-4.458.51,8.5374,8.5374,0,0,0-2.9727,1.4009,5.484,5.484,0,0,0-1.6767,2.06,5.9256,5.9256,0,0,0-.5313,2.4839,4.8692,4.8692,0,0,0,1.6982,4.0127,7.1335,7.1335,0,0,0,4.629,1.38,8.096,8.096,0,0,0,4.5-1.5713,32.4594,32.4594,0,0,0,5.1376-4.5Z" transform="translate(-219.0322 -218.6855)" style="fill: #fff"/>
    <path d="M784.1836,277.0269a32.3761,32.3761,0,0,1-6.3262,1.8256,38.2063,38.2063,0,0,1-6.8369.5943,28.2532,28.2532,0,0,1-9.2139-1.4009,18.3346,18.3346,0,0,1-6.9209-4.1611,18.1137,18.1137,0,0,1-4.3525-6.8365,27.1008,27.1008,0,0,1-1.5068-9.4262,25.7037,25.7037,0,0,1,1.6347-9.3838,19.9443,19.9443,0,0,1,11.7618-11.7617,25.7116,25.7116,0,0,1,9.3193-1.6133,47.0671,47.0671,0,0,1,7.07.4458,39.9275,39.9275,0,0,1,5.1592,1.125v10.0635a26.045,26.045,0,0,0-5.711-2.0381,25.624,25.624,0,0,0-5.8388-.7222,13.111,13.111,0,0,0-5.18.9766,10.852,10.852,0,0,0-3.8643,2.7177,11.7784,11.7784,0,0,0-2.3994,4.2246,17.18,17.18,0,0,0-.8281,5.4566,16.25,16.25,0,0,0,.8926,5.562,11.7945,11.7945,0,0,0,2.5263,4.1826,10.9,10.9,0,0,0,3.9268,2.6323,13.6525,13.6525,0,0,0,5.0957.9131,22.9062,22.9062,0,0,0,2.8662-.1909,28.161,28.161,0,0,0,3.0147-.5522q1.5072-.36,2.9726-.8282a29.065,29.065,0,0,0,2.7383-1.019Z" transform="translate(-219.0322 -218.6855)" style="fill: #fff"/>
    <path d="M804.31,287.8115H794.2471l29.6367-69.126H833.99Z" transform="translate(-219.0322 -218.6855)" style="fill: #fff"/>
    <path d="M871.9492,279.6592l-28.6181-24.1177,28.6181-24.0752,6.624,6.709-21.0605,17.2812L878.5732,272.95Z" transform="translate(-234 -218.6855)" style="fill: #fff"/>
    <g hidden transform="scale(0.75 0.75) translate(390,20)">
        <path d="M250.2905,341.1675a21.73,21.73,0,0,1-1.1128,7.2075,15.1836,15.1836,0,0,1-3.16,5.3853,13.5905,13.5905,0,0,1-4.9824,3.3862,17.6207,17.6207,0,0,1-6.6109,1.1772,32.62,32.62,0,0,1-5.8691-.5483,30.0382,30.0382,0,0,1-5.9341-1.7417V312.3691h5.6113v12.545l-.2578,5.998a14.559,14.559,0,0,1,5.1758-4.5952,13.3752,13.3752,0,0,1,5.9175-1.3384,9.885,9.885,0,0,1,4.87,1.1611,10.1123,10.1123,0,0,1,3.5151,3.273,15.4959,15.4959,0,0,1,2.1285,5.0952A28.85,28.85,0,0,1,250.2905,341.1675Zm-5.74.2578a27.3316,27.3316,0,0,0-.3711-4.6763,12.2078,12.2078,0,0,0-1.1768-3.644,6.4693,6.4693,0,0,0-2.0639-2.37,5.21,5.21,0,0,0-2.999-.8545,7.2978,7.2978,0,0,0-2.1607.3384,8.761,8.761,0,0,0-2.2739,1.1289,16.9429,16.9429,0,0,0-2.4829,2.0961,32.996,32.996,0,0,0-2.79,3.2408V352.39a21.7774,21.7774,0,0,0,3.354,1.0162,15.3828,15.3828,0,0,0,3.2569.3706,11.1293,11.1293,0,0,0,3.6923-.6128,7.62,7.62,0,0,0,3.0962-2.0479,10.2561,10.2561,0,0,0,2.1285-3.8052A18.8354,18.8354,0,0,0,244.55,341.4253Z" transform="translate(-219.0322 -218.6855)" style="fill: #fff"/>
        <path d="M287.7314,325.5591l-11.0293,28.959a56.8181,56.8181,0,0,1-3.5312,7.6108,22.5825,22.5825,0,0,1-3.9824,5.24,14.0223,14.0223,0,0,1-4.7407,3.0152,16.339,16.339,0,0,1-5.7725.9678q-.8394,0-1.5156-.0323t-1.4834-.0967v-5.0957q.7089.0975,1.5478.1778t1.7735.08a8.9769,8.9769,0,0,0,2.8862-.4516,7.7069,7.7069,0,0,0,2.5317-1.4673,13.1,13.1,0,0,0,2.29-2.6284,25.9861,25.9861,0,0,0,2.1284-3.9019l-12.9316-32.3774h6.3852l8.1909,21.4131,1.645,5.0307,1.87-5.16,7.5786-21.2837Z" transform="translate(-219.0322 -218.6855)" style="fill: #fff"/>
        <path d="M358.4844,356.3564a27.4669,27.4669,0,0,1-10.61,2.0962q-8.9334,0-13.7217-5.3374t-4.789-15.7856a29.7163,29.7163,0,0,1,1.3222-9.1587,19.9084,19.9084,0,0,1,3.773-6.9492,16.6112,16.6112,0,0,1,5.9341-4.4024,19.0146,19.0146,0,0,1,7.8037-1.5478,27.9912,27.9912,0,0,1,5.45.5,22.8732,22.8732,0,0,1,4.8374,1.5317v5.6436a21.4225,21.4225,0,0,0-4.7407-1.919,20.5267,20.5267,0,0,0-5.3531-.6611,12.6262,12.6262,0,0,0-5.37,1.1128,11.1065,11.1065,0,0,0-4.0791,3.2246,15.0909,15.0909,0,0,0-2.58,5.16,24.4787,24.4787,0,0,0-.9028,6.9492q0,8.1921,3.3213,12.3515t9.7392,4.16a21.0893,21.0893,0,0,0,5.1919-.6289,24.2013,24.2013,0,0,0,4.773-1.7578Z" transform="translate(-219.0322 -218.6855)" style="fill: #fff"/>
        <path d="M378.8979,316.981H369.32v-4.6119h15.2539V353.26h9.6421v4.6762h-25.96V353.26h10.642Z" transform="translate(-219.0322 -218.6855)" style="fill: #fff"/>
        <path d="M424.981,357.9365l-.1289-4.3535a17.56,17.56,0,0,1-5.3692,3.773,14.46,14.46,0,0,1-5.7241,1.1611,14.0271,14.0271,0,0,1-4.7407-.71,8.87,8.87,0,0,1-3.2412-1.9512,7.5535,7.5535,0,0,1-1.87-2.9184,10.7921,10.7921,0,0,1-.5966-3.6441,9.0461,9.0461,0,0,1,3.6279-7.6269q3.6276-2.7568,10.7226-2.7573h6.7076v-2.8379a6.0037,6.0037,0,0,0-1.8379-4.5952q-1.8384-1.7249-5.6114-1.7251a24.0376,24.0376,0,0,0-5.4018.6123,37.9889,37.9889,0,0,0-5.4981,1.7417v-5.063q1.0643-.3875,2.37-.7578t2.7573-.6612q1.451-.29,3.0312-.4677a28.7239,28.7239,0,0,1,3.1929-.1773,20.0343,20.0343,0,0,1,5.2886.645,10.7345,10.7345,0,0,1,3.9829,1.9673,8.6662,8.6662,0,0,1,2.499,3.3213,11.7224,11.7224,0,0,1,.8706,4.7085v22.3159Zm-.6128-14.7378h-7.127a13.6733,13.6733,0,0,0-3.6118.42,6.8536,6.8536,0,0,0-2.4829,1.1933,4.7864,4.7864,0,0,0-1.4351,1.854,6.0691,6.0691,0,0,0-.4677,2.4351,5.5127,5.5127,0,0,0,.2905,1.79,3.9735,3.9735,0,0,0,.935,1.5157,4.5132,4.5132,0,0,0,1.6768,1.0483,7.1992,7.1992,0,0,0,2.5156.3867,10.636,10.636,0,0,0,4.4341-1.1767,21.6673,21.6673,0,0,0,5.2725-3.7251Z" transform="translate(-219.0322 -218.6855)" style="fill: #fff"/>
        <path d="M441.8149,325.5591h5.1275l.1611,5.9658a20.78,20.78,0,0,1,5.66-4.9985,11.4922,11.4922,0,0,1,5.6274-1.5479q5.031,0,7.627,3.2569T468.42,337.91h-5.6758q.0968-4.2568-1.2412-6.1758a4.4756,4.4756,0,0,0-3.9184-1.9185,6.8093,6.8093,0,0,0-2.2735.4029,9.2078,9.2078,0,0,0-2.354,1.29,21.19,21.19,0,0,0-2.5639,2.2734,42.1,42.1,0,0,0-2.9024,3.354v20.8h-5.6758Z" transform="translate(-219.0322 -218.6855)" style="fill: #fff"/>
        <path d="M487.8335,330.2026h-9.5781v-4.6435h15.2539V353.26h9.6421v4.6762h-25.96V353.26h10.6421Zm1.9668-18.22a4.4552,4.4552,0,0,1,1.7417.3384,4.221,4.221,0,0,1,1.4028.9517,4.5788,4.5788,0,0,1,.9351,1.4023,4.52,4.52,0,0,1,0,3.4346,4.5226,4.5226,0,0,1-.9351,1.4189,4.221,4.221,0,0,1-1.4028.9517,4.65,4.65,0,0,1-3.4829,0,4.2123,4.2123,0,0,1-1.4029-.9517,4.5154,4.5154,0,0,1-.935-1.4189,4.52,4.52,0,0,1,0-3.4346,4.5713,4.5713,0,0,1,.935-1.4023,4.2123,4.2123,0,0,1,1.4029-.9517A4.451,4.451,0,0,1,489.8,311.9824Z" transform="translate(-219.0322 -218.6855)" style="fill: #fff"/>
        <path d="M540.7207,328.687a14.2258,14.2258,0,0,1-.9668,5.1113,12.6255,12.6255,0,0,1-3,4.5313,15.1956,15.1956,0,0,1-5.1914,3.2407,20.6232,20.6232,0,0,1-7.5469,1.2417H518.792v15.1245h-5.74V315.7876H524.92a25.4843,25.4843,0,0,1,5.9981.6934,14.49,14.49,0,0,1,5.0468,2.2412,11.2745,11.2745,0,0,1,3.4668,3.999A12.6823,12.6823,0,0,1,540.7207,328.687Zm-5.9658.2578a7.5536,7.5536,0,0,0-2.66-6.2236q-2.6616-2.1606-7.4336-2.1607H518.792v17.35h5.3535q5.0948,0,7.8525-2.2251T534.7549,328.9448Z" transform="translate(-219.0322 -218.6855)" style="fill: #fff"/>
        <path d="M578.1621,357.9365H571.68l-6.2881-13.48a14.9693,14.9693,0,0,0-1.4512-2.5634,6.9269,6.9269,0,0,0-1.5966-1.6128,5.7053,5.7053,0,0,0-1.87-.8545,9.2468,9.2468,0,0,0-2.2744-.2578h-2.708v18.7685h-5.74V315.7876h11.2861a21.8362,21.8362,0,0,1,6.3213.8062,11.9064,11.9064,0,0,1,4.3369,2.2573,8.6571,8.6571,0,0,1,2.4844,3.499,12.5244,12.5244,0,0,1,.7891,4.5312,11.809,11.809,0,0,1-.58,3.7247,10.2274,10.2274,0,0,1-1.7246,3.1923,10.9917,10.9917,0,0,1-2.8379,2.4834,12.9671,12.9671,0,0,1-3.8867,1.564,6.6154,6.6154,0,0,1,3.0156,2.1445,23.1882,23.1882,0,0,1,2.5312,4.08Zm-9.1914-30.5718a6.0743,6.0743,0,0,0-2.1113-5.0629,9.3617,9.3617,0,0,0-5.9512-1.6768h-5.417v13.9312h4.6436a13.2671,13.2671,0,0,0,3.66-.4673,7.8176,7.8176,0,0,0,2.7735-1.3868,6.2743,6.2743,0,0,0,1.7734-2.2573A7.155,7.155,0,0,0,568.9707,327.3647Z" transform="translate(-219.0322 -218.6855)" style="fill: #fff"/>
        <path d="M598.6719,350.0034a4.06,4.06,0,0,1,1.6445.3384,4.175,4.175,0,0,1,1.3379.9194,4.4729,4.4729,0,0,1,.9043,1.3706,4.1913,4.1913,0,0,1,.3379,1.6607,4.0763,4.0763,0,0,1-.3379,1.6445,4.2417,4.2417,0,0,1-2.2422,2.2412,4.0518,4.0518,0,0,1-1.6445.3389,4.1345,4.1345,0,0,1-1.6768-.3389,4.5061,4.5061,0,0,1-1.3545-.9028,4.1813,4.1813,0,0,1-.9189-1.3384,4.06,4.06,0,0,1-.3389-1.6445,4.1749,4.1749,0,0,1,.3389-1.6607,4.3239,4.3239,0,0,1,.9189-1.3706,4.37,4.37,0,0,1,1.3545-.9194A4.1425,4.1425,0,0,1,598.6719,350.0034Zm3.3867-37.6343-.8711,33.2163h-4.9668l-.9668-33.2163Z" transform="translate(-219.0322 -218.6855)" style="fill: #fff"/>
        <path d="M649.3994,357.9365H641.918l-12.2871-26.2827-3.5469-8.4492v34.7319h-5.3535V315.7876h7.3847l11.7061,24.896,4.2246,9.6421V315.7876h5.3535Z" transform="translate(-219.0322 -218.6855)" style="fill: #fff"/>
        <path d="M686.7422,320.69h-12.48v37.247H668.458V320.69H655.9775v-4.9019h30.7647Z" transform="translate(-219.0322 -218.6855)" style="fill: #fff"/>
    </g>
  </g>
</svg> -->
                <svg id="Calque_2" data-name="Calque 2" xmlns="http://www.w3.org/2000/svg" viewBox="20 0 160 72" style="width: 280px;" height="80px">
                    <g fill="white" fill-opacity="1.0" font-family="Arial, Helvetica, sans-serif" font-weight="normal" alignment-baseline="baseline" text-anchor="left">
                        <text x="0" y="30" alignment-baseline="baseline" font-size="20pt" >pac</text>
                        <text x="45" y="30" alignment-baseline="baseline" font-size="25pt">/</text>
                        <text x="54" y="30" alignment-baseline="baseline" font-size="20pt">&lt;</text>
                        <text x="75" y="30" alignment-baseline="baseline" font-size="25pt">.</text>
                        <text x="88" y="30" alignment-baseline="baseline" font-size="25pt">/</text>
                        <text x="99" y="30" font-size="20pt" alignment-baseline="baseline">&gt;</text>
                        <text x="116" y="30" font-size="20pt" alignment-baseline="baseline">uilders</text>
                        <g transform='scale(0.85 1)'><text x="-2" y="50" font-size="14pt" alignment-baseline="baseline">brand packaging community</text></g>
                    </g>
                </svg>           <!--     <div style="color:white;">
                    <span style="font-size: 20pt;">pac</span>
                    <span style="font-size: 40pt;">/</span>
                    <span style="font-size: 30pt;">&lt;.</span>
                    <span style="font-size: 40pt;">/</span>
                    <span style="font-size: 30pt;">&gt;</span>
                    <span style="font-size: 20pt;">uilders</span>
                </div>
                <div style="color:white;font-size: 15pt;font-style: italic;">Let build your pack</div> -->
            </a>                   
        </span>
        <button class="navbar-toggler" type="button" data-toggle="collapse" data-target="#mainNavbarSupportedContent" aria-controls="mainNavbarSupportedContent" aria-expanded="false" aria-label="Toggle navigation">
                <span class="navbar-toggler-icon"></span>
        </button>
        <span align="right" class="collapse navbar-collapse" id="mainNavbarSupportedContent">
            <ul class="navbar-nav m-0 w-100 ml-0 mr-5">
            <?php if ($userid) { ?>
                <li class="start" style="width:7%">&nbsp;</li>
                <li class="nav-item active" title="<?= $usermail ?>" style="">
                    <a class="mx-3" href="/logout"><?= lang("App.Logout") ?></a>
<!--                    <div style="display:block; margin:0px;">
                      <a class="nav-link dropdown-toggle userlink" href="#" id="navbarAccount" role="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false" style="border-radius: 6px 0 0 6px;">
                        <?= lang("App.Hello") ?>, <?= $nickname ?> <?php if ($usersupplier) { ?>(<?= lang("App.supplier") ?>)<?php } ?>
                      </a>
                      <div class="dropdown-menu bg-light" aria-labelledby="navbarAccount" style="right:2%;left:auto;">
                        <a class="dropdown-item bg-light" href="/logout"><?= lang("App.Logout") ?></a>
                        <a class="dropdown-item bg-light" href="https://www.expert-solutions.fr/quoteyourpack" target="_blank"><?= lang("App.More_informations") ?></a>                       
                      </div>
                    </div> -->
                </li>
            <?php } else { ?>           
                <li class="w-100">&nbsp;</li>
                <li class="nav-item active" style="">
                    <a class="mx-3" href="/login"><?= lang("App.Connect") ?></a>
<!--                    <div style="display:block; margin:0px;">
                      <a class="nav-link dropdown-toggle userlink text-light" href="#" id="navbarAccount" role="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false" style="border-radius: 8px 0 0 8px;">
                        <?= lang("App.Hello_connect_you") ?>
                      </a>
                      <div class="dropdown-menu bg-light" aria-labelledby="navbarAccount" style="">
                        <a class="dropdown-item bg-light" href="/login"><?= lang("App.Connect") ?></a>
                        <a class="dropdown-item bg-light" href="https://www.expert-solutions.fr/quoteyourpack" target="_blank"><?= lang("App.More_informations") ?></a>                       
                      </div>
                    </div> -->
                </li>
                <li class="nav-item active" style="">
                    <a class="freetry btn btn-light pt-1 pb-2 px-3" href="/login"><?= lang("App.Hello_connect_you") ?></a>
                </li>                
            <?php } ?>
                <li class="nav-item active text-right" title="" style="min-width:50px;width:3%;">
                    <div style="display:block; margin:0px;">
                      <a class="nav-link dropdown-toggle userlink text-light" href="#" id="navbarLocal" role="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false" style="border-radius: 6px 0 0 6px;">
                        <?= $userlang ?>
                      </a>
                      <div class="dropdown-menu bg-light" aria-labelledby="navbarLocal" style="">
                        <?php 
                        $langs = [
                                    "nl" => "Dutch",
                                    "en" => "English",
                                    "de" => "German",
                                    "fr" => "French",
                                    "it" => "Italian",
                                    "es" => "Spanish",
                                    "pl" => "Polish",
                                    "pt" => "Portuguese",
                                    "sv" => "Swedish"
                                ];
                        foreach ($langs as $code => $lang) { ?>
                        <a class="dropdown-item" href="<?= base_url('lang/' . $code); ?>"><?= $lang ?></a>
                        <?php } ?>
                        </div>
                    </div>
                </li>
            </ul>
        </span>
    </nav>
<?php if (!$userid) { ?>
    <div id="welcome" class="container-fluid w-100 text-light mt-4 mx-auto" style="max-width: 1500px;">
        <div class="row">
            <div class="col-sm-12 col-md-6 p-2 p-md-4 p-lg-5" style="">
                <H1 class="p-0 m-0" style="text-align: left; font-weight: bold;"><?= lang("App.Welcome_msg") ?></H1>
                <H1 class="p-0 m-0" style="text-align: left; color:green; font-weight: bold;"><?= lang("App.Welcome_sub") ?></H1>
            <!--    <H4 style="text-align: left"><?= lang("App.Enjoy_video") ?></H4> -->
                <H6 class="mt-3" style="font-size: 1.125rem;font-weight: 400;line-height: 1.444;letter-spacing: -.25px;font-family: 'Helvetica Neue',Helvetica,'Segoe UI',Tahoma,Arial,sans-serif;"><?= lang("App.Account_why_title") ?></H5>
                <a class="btn btn-light p-4 m-2" href="/login" style="white-space: nowrap;font-weight: bold;"><?= lang("App.Account_why_arg1") ?></a>
       <!--         <ul>
                    <li><?= lang("App.Account_why_arg1") ?></li>
                    <li><?= lang("App.Account_why_arg2") ?></li>
                    <li><?= lang("App.Account_why_arg3") ?></li>
                </ul> -->
            </div>
            <div class="col-sm-12 col-md-6 p-2 p-md-3 p-lg-5 m-0 px-0">
                <style type="text/css">
                    .video-js {
                        background-color: transparent;
                    }
                   /* .video-js.vjs-ended {
                        display: none;
                    } */
                    .video-js.vjs-ended .vjs-poster, 
                    .video-js.vjs-ended .vjs-big-play-button {
                        display: block;
                    }
                    .video-js.vjs-ended video{
                        display: none;
                    } 
                    .video-js.vjs-play video{
                        display: block;
                    }

                </style>
                <video  style="border-radius: 15em 0em 15em 0em;"
    id="my-video"
    class="w-100 video-js vjs-fluid vjs-7-5"
    controls
    preload="auto"
    width="800"
    height="600"
    poster="/img/landingimg.png" 
    data-setup='{"autoplay":true,"muted":true, "loop" : true}'>
                    <source src="/img/landing_short_overview.mp4" type="video/mp4" />
                    <source _src="/img/qyp_video_low.mp4" type="video/mp4" />
                    <source src="/img/intro.webm" type="video/webm" />
                    <!-- fallback contenu ici -->
                     <p class="vjs-no-js">
                      To view this video please enable JavaScript, and consider upgrading to a
                      web browser that
                      <a href="https://videojs.com/html5-video-support/" target="_blank"
                        >supports HTML5 video</a
                      ><br>
                      This video will show you a short abstract of the usage of pack.builders website while a loggin session. You could watch the choice of a packaging model, the customizing of dimensions, materials as paper or cardboard, finishing such as lamination gliding. Then you would watch de 3D mokup, the one click pricing of the project, then the choice of the builder throw an interactive map.
                    </p>
                  </video>

            </div>
        </div>
    </div>
<?php } ?>
</header>
<section>
<!-- CONTENT -->

 
    <div role="SugarCrepe" class="mx-auto" style="max-width: 1500px;"
        options='{
    "verbose" : -1,
    "ui_mode" : "<?php if ($usersupplier) { ?>supplier<?php } else if ($usermail === "adminqyp@clariprint.com") { ?>admin<?php } else if ($usermail) { ?>client<?php } else { ?>disconnect<?php } ?>",
    "ui_lang" : "<?= $userlang ?>",
    "sugarcrepe_server" : "https://sugar.clariprint.com/json.wcl",
    "sugarcrepe_headless" : "https://headless.clariprint.com/",
    "mainbar" : "nav.mainbar",
    "mainbartooglebtn" : "li.start",

    "root_ejs" : { "base" : "/ejs/",
        "clariprint_HLUX" : "/ejs/clariprint/"
    },

    "root_img" : { "base" : "/img/",
        "clariprint_HLUX" : "/img/clariprint/"
    },

    "root_css" : { "base" : "https://headless.clariprint.com/css/",
        "clariprint_HLUX" : "https://headless.clariprint.com/modules/clariprint_HLUX/css/"
    },

    "root_js" : { "base" : "https://headless.clariprint.com/js/",
        "clariprint_HLUX" : "https://headless.clariprint.com/modules/clariprint_HLUX/js/"
    },
    "root_lang" : { "base" : "/lang/" },

    "http_apis" : {
        "get" : { "url" : "/api/httpget", "method" : "GET" },
        "get64" : { "url" : "/api/httpgetencode64", "method" : "GET" }
    }, 

    "share_apis" : {
        "uid" : { "url" : "/api/uid", "method" : "GET" }
    },

    "projects_apis" : {
        "list" : { "url" : "/api/projects", "method" : "GET" },
        "get" : { "url" : "/api/project", "method" : "GET" },
        "set" : { "url" : "/api/project", "method" : "POST" },
        "remove" : { "url" : "/api/remove", "method" : "GET" },
        "order" : {"url" : "", "method" : "POST"}
    },

    "baskets_apis" : {
        "list" : { "url" : "/api/baskets", "method" : "GET" },
        "get" : { "url" : "/api/basket", "method" : "GET" },
        "set" : { "url" : "/api/basket", "method" : "POST" },
        "move" : {"url" : "/api/baskettoorder", "method" : "POST" },
        "remove" : { "url" : "/api/basket_remove", "method" : "GET" }
    },

    "lines_apis" : {
        "list" : { "url" : "/api/lines", "method" : "GET" },
        "set" : { "url" : "/api/line", "method" : "POST" },
        "get" : { "url" : "/api/line", "method" : "GET" },
        "remove" : { "url" : "/api/line_remove", "method" : "GET" }
    },

    "orders_apis" : {
        "list" : { "url" : "/api/orders", "method" : "GET" },
        "get" : { "url" : "/api/order", "method" : "GET" },
        "last": { "url" : "/api/lastorder", "method" : "GET" },
        "set" : { "url" : "/api/order", "method" : "POST" },
        "invoice" : { "url" : "/api/ordertoinvoice", "method" : "POST" },
        "status" : { "url" : "/api/orderstatus", "method" : "POST" },
        "close" : { "url" : "/api/close", "method" : "GET" }
    },

    "cold_orders_apis" : {
        "list" : { "url" : "/api/cold_orders", "method" : "GET" },
        "get" : { "url" : "/api/cold_order", "method" : "GET" },
        "reopen" : { "url" : "/api/reopen", "method" : "GET" }
    },

    "incomes_apis" : {
        "list" : { "url" : "/api/incomes", "method" : "GET" },
        "get" : { "url" : "/api/income", "method" : "GET" },
        "set" : { "url" : "/api/income", "method" : "POST" }
    },

    "cold_incomes_apis" : {
        "list" : { "url" : "/api/cold_incomes", "method" : "GET" },
        "get" : { "url" : "/api/cold_income", "method" : "GET" }
    },


    "invoices_apis" : {
        "list" : { "url" : "/api/invoices", "method" : "GET" },
        "get" : { "url" : "/api/invoice", "method" : "GET" },
        "last": { "url" : "/api/lastinvoice", "method" : "GET" },
        "set" : { "url" : "/api/invoice", "method" : "POST" }
    },

    "parameters" : {
        "clariprint_HLUX" : {
            "materials_server" : "https://lrdp.clariprint.com/optimproject/json.wcl",
            "materials_login" : "IDR_API_PAPERS",
            "materials_pwd" : "IDR_API_PAPERS"
        }
    }
}'
        ux="all rc *spc *cust *3D *pl market"></div>

<!--        <div role="SugarCrepe" url="http://dev.sugarcrepe.local/json.wcl" layout="S0" ux="all -rc *spc *cust *3D *pl"></div> -->
</section>



<!-- FOOTER: DEBUG INFO + COPYRIGHTS -->

<footer class="pt-0">
<?php if (!$userid) { ?>
    <section>
        <div class="container-fluid" style="max-width:1500px;"> 
        <div class="row">
            <div class="col-12 col-sm-12 col-md-7 col-lg-6">
               <video style="border-radius: 0 20em 20em 0;" 
    id="my-video"
    class="video-js vjs-fluid vjs-7-5"
    controls
    preload="auto"
    width="800"
    height="600"
    poster="/img/landingimg.png" 
    data-setup='{"autoplay":true,"muted":true, "loop" : false}'>
                    <source src="/img/custom_template.mp4" type="video/mp4" />
                    <source src="/img/intro.webm" type="video/webm" />
                    <!-- fallback contenu ici -->
                     <p class="vjs-no-js">
                      To view this video please enable JavaScript, and consider upgrading to a
                      web browser that
                      <a href="https://videojs.com/html5-video-support/" target="_blank"
                        >supports HTML5 video</a
                      >
                    </p>
                  </video>                
            </div>
            <div class="content-container col col-sm-12 col-md-5 col-lg-6 p-2 p-md-5">
                <h1 class="text-left m-0 p-2"><?= lang("App.Footer_section3_title") ?></h1>
                <h5 class="text-left m-0 p-2"><?= lang("App.Footer_section3_sub") ?></h5>
            </div>
        </div>    
        </div>    
    </section>
    <section>
        <div class="container-fluid" style="max-width:1500px;"> 
        <div class="row">
            <div class="content-container col col-12 col-md-5 col-lg-6 p-2 p-md-5">
                <h1 class="text-left m-0 p-2"><?= lang("App.Footer_section4_title") ?></h1>
                <h5 class="text-left m-0 p-2"><?= lang("App.Footer_section4_sub") ?></h5>
            </div>
            <div class="col col-sm-12 col-md-7 col-lg-6">
               <video  style="border-radius: 20em 0em 0em 20em;"
    id="my-video"
    class="video-js vjs-fluid vjs-7-5"
    controls
    preload="auto"
    width="800"
    height="600"
    poster="/img/landingimg.png" 
    data-setup='{"autoplay":true,"muted":true, "loop" : false}'>
                    <source src="/img/custom_design.mp4" type="video/mp4" />
                    <source src="/img/intro.webm" type="video/webm" />
                    <!-- fallback contenu ici -->
                     <p class="vjs-no-js">
                      To view this video please enable JavaScript, and consider upgrading to a
                      web browser that
                      <a href="https://videojs.com/html5-video-support/" target="_blank"
                        >supports HTML5 video</a
                      >
                    </p>
                  </video>                
            </div>
        </div>    
        </div>    
    </section>
    <section>
        <div class="container-fluid" style="max-width:1500px;"> 
        <div class="row">
            <div class="col col-12 col-md-7 col-lg-6">
               <video  style="border-radius: 0em 20em 20em 0em;"
    id="my-video"
    class="video-js vjs-fluid vjs-7-5"
    controls
    preload="auto"
    width="800"
    height="600"
    poster="/img/landingimg.png" 
    data-setup='{"autoplay":true,"muted":true, "loop" : false}'>
                    <source src="/img/edit_files_on_canva.mp4" type="video/mp4" />
                    <source src="/img/intro.webm" type="video/webm" />
                    <!-- fallback contenu ici -->
                     <p class="vjs-no-js">
                      To view this video please enable JavaScript, and consider upgrading to a
                      web browser that
                      <a href="https://videojs.com/html5-video-support/" target="_blank"
                        >supports HTML5 video</a
                      >
                    </p>
                  </video>                
            </div>
            <div class="content-container col col-12 col-md-5 col-lg-6 p-2 p-md-5">
                <h1 class="text-left m-0 p-2"><?= lang("App.Footer_section1_title") ?></h1>
                <h5 class="text-left m-0 p-2"><?= lang("App.Footer_section1_sub") ?></h5>
            </div>
        </div>    
        </div>    
    </section>
    <section>
        <div class="container-fluid" style="max-width:1500px;"> 
        <div class="row">
            <div class="content-container col col-12 col-md-5 col-lg-6 p-2 p-md-5">
                <h1 class="text-left m-0 p-2"><?= lang("App.Footer_section2_title") ?></h1>
                <h5 class="text-left m-0 p-2"><?= lang("App.Footer_section2_sub") ?></h5>
            </div>
            <div class="col col-sm-12 col-md-7 col-lg-6">
               <video  style="border-radius: 20em 0em 0em 20em;"
    id="my-video"
    class="video-js vjs-fluid vjs-7-5"
    controls
    preload="auto"
    width="800"
    height="600"
    poster="/img/landingimg.png" 
    data-setup='{"autoplay":true,"muted":true, "loop" : false}'>
                    <source src="/img/choice_your_builder.mp4" type="video/mp4" />
                    <source src="/img/intro.webm" type="video/webm" />
                    <!-- fallback contenu ici -->
                     <p class="vjs-no-js">
                      To view this video please enable JavaScript, and consider upgrading to a
                      web browser that
                      <a href="https://videojs.com/html5-video-support/" target="_blank"
                        >supports HTML5 video</a
                      >
                    </p>
                  </video>                
            </div>
        </div>    
        </div>    
    </section>
    <section>
        <div class="container-fluid" style="max-width:1500px;"> 
        <div class="row">
            <div class="col col-12 col-md-7 col-lg-6">
               <video  style="border-radius: 0 20em 20em 0;"
    id="my-video"
    class="video-js vjs-fluid vjs-7-5"
    controls
    preload="auto"
    width="800"
    height="600"
    poster="/img/landingimg.png" 
    data-setup='{"autoplay":true,"muted":true, "loop" : false}'>
                    <source src="/img/builder_view.mp4" type="video/mp4" />
                    <source src="/img/intro.webm" type="video/webm" />
                    <!-- fallback contenu ici -->
                     <p class="vjs-no-js">
                      To view this video please enable JavaScript, and consider upgrading to a
                      web browser that
                      <a href="https://videojs.com/html5-video-support/" target="_blank"
                        >supports HTML5 video</a
                      >
                    </p>
                  </video>                
            </div>
            <div class="content-container col col-sm-12 col-md-5 col-lg-6 p-2 p-md-5">
                <h1 class="text-left m-0 p-2"><?= lang("App.Footer_section5_title") ?></h1>
                <h5 class="text-left m-0 p-2"><?= lang("App.Footer_section5_sub") ?></h5>
            </div>
        </div>    
        </div>    
    </section>
<?php } ?>
<div class="container bg-dark w-100 text-white" style="max-width:1500px!important;text-align: left;">
    <div class="row" style="">
        <div class="col-3">
            <div id="footer_logo" class="mx-1 mt-3 mb-3">
            </div>
            <script type="text/javascript">
                $("div#footer_logo").html($("svg#Calque_2").parent().html());
                $("div#footer_logo").find("path").attr("style","fill:#AAAAAA;");
            </script>
        </div>
    </div>
    <div class="row" style="">
        <div class="col col-lg-3 col-md-3 col-sm-12 mt-2">
            <div class="list-group list-group-flush">
                <h6 style="margin: 0;font-weight: bold;"><?= lang("App.COL1_title")?></h6>
                <a class="mt-1 text-light" style="background-color: transparent;" href=""><?= lang("App.COL1_arg1")?></a>
                <a class="mt-1 text-light" style="background-color: transparent;" href=""><?= lang("App.COL1_arg2")?></a>
                <a class="mt-1 text-light" style="background-color: transparent;" href=""><?= lang("App.COL1_arg3")?></a>
            </div>
        </div>
        <div class="col col-lg-3 col-md-3 col-sm-12 mt-2">
            <div class="list-group list-group-flush">
                <h6 style="margin: 0;font-weight: bold;"><?= lang("App.COL2_title")?></h6>
                <a class="mt-1 text-light" style="background-color: transparent;" href=""><?= lang("App.COL2_arg1")?></a>
                <a class="mt-1 text-light" style="background-color: transparent;" href=""><?= lang("App.COL2_arg2")?></a>
                <a class="mt-1 text-light" style="background-color: transparent;" href=""><?= lang("App.COL2_arg3")?></a>
            </div>
        </div>
        <div class="col col-lg-3 col-md-3 col-sm-12 mt-2">
            <div class="list-group list-group-flush">
                <h6 style="margin: 0;font-weight: bold"><?= lang("App.COL3_title")?></h6>
                <a class="mt-1 text-light" style="background-color: transparent;" href="https://www.fefco.org/technical-information/fefco-code"><?= lang("App.COL3_arg1")?></a>
                <a class="mt-1 text-light" style="background-color: transparent;" href="https://www.expert-solutions.fr/clariprint/"><?= lang("App.COL3_arg2")?></a>
                <a class="mt-1 text-light" style="background-color: transparent;" href="https://www.expert-solutions.fr/clariprint/"><?= lang("App.COL3_arg3")?></a>
            </div>
        </div>
        <div class="col col-lg-3 col-md-3 col-sm-12 mt-2">
            <div class="list-group list-group-flush">
                <h6 style="margin: 0;font-weight: bold"><?= lang("App.COL4_title")?></h6>
                <a class="mt-1 text-light" style="background-color: transparent;" href="https://www.expert-solutions.fr/7b3c2-about/"><?= lang("App.COL4_arg1")?></a>
                <a class="mt-1 text-light" style="background-color: transparent;" href="https://www.expert-solutions.fr/notre-histoire/"><?= lang("App.COL4_arg2")?></a>
                <a class="mt-1 text-light" style="background-color: transparent;" href="https://www.expert-solutions.fr/7b3c2-blog-archive/"><?= lang("App.COL4_arg3")?></a>
            </div>
        </div>
    </div>
    <div class="row" style="">
        <div class="col-12"><hr style="border-top: 1px solid white;"></div>
    </div>
    <div class="row" style="">
        <div class="col-12">
            <h6 style="margin: 0;"><?= lang("App.Follow")?> <a href="https://www.linkedin.com/company/quoteyourpack/about/?viewAsMember=true" target="_blank">
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 256 256" width="20px" height="20px" xml:space="preserve">
<g><g><g><path fill="#FFFFFF" d="M233.5,10H22.5C15.6,10,10,15.6,10,22.5v210.9c0,6.9,5.6,12.5,12.5,12.5h210.9c6.9,0,12.5-5.6,12.5-12.5V22.5C246,15.6,240.4,10,233.5,10z M76.3,221.4H37.5V96.6h38.8L76.3,221.4L76.3,221.4z M56.9,79.6c-12.4,0-22.5-10.1-22.5-22.5c0-12.4,10.1-22.5,22.5-22.5c12.4,0,22.5,10.1,22.5,22.5C79.4,69.5,69.3,79.6,56.9,79.6z M221.6,221.4h-38.8v-60.7c0-14.5-0.3-33.1-20.2-33.1c-20.2,0-23.3,15.8-23.3,32v61.7h-38.8V96.6h37.2v17.1h0.5c5.2-9.8,17.8-20.2,36.7-20.2c39.3,0,46.5,25.8,46.5,59.4L221.6,221.4L221.6,221.4z"/></g></g></g>
</svg>
            </a>
            </h6>
        </div>
    </div>
    <div class="row" style="">
        <div class="col-12"><hr style="border-top: 1px solid white;"></div>
    </div>
    <div class="row" style="">
        <div class="col-2">
            <a class="text-light" href=""><?= lang("App.Legal")?></a>
        </div>
        <div class="col-2">
            <a class="text-light" rel="privacy-policy" href=""><?= lang("App.Privacy")?></a>
        </div>
        <div class="col-2">
            <a class="text-light" href=""><?= lang("App.Terms")?></a>
        </div>
        <div class="col-6" style="text-align: right;">
            <H6 title="&copy; <?= date('Y') ?> expert-solutions sarl - RCS LA ROCHELLE 424 836 989 00055 - contact@expter-solutions.fr - powered by Clariprint & Sugarcrepe">Expert-solutions <?= date('Y') ?>&nbsp;</H6>
        </div>
    </div>
</div>
</footer>
<?php if (!$userid) { ?>
  <script src="https://vjs.zencdn.net/8.6.0/video.min.js"></script>
<script type="text/javascript">
var player = videojs('my-video');

player.ready(function() {
  var promise = player.play();

  if (promise !== undefined) {
    promise.then(function() {
      // Autoplay started!
        console.log("Autoplay started!");
    }).catch(function(error) {
      // Autoplay was prevented.
        console.log("Autoplay was prevented.");
    });
  }
});
</script>
<?php } ?>

<!-- SCRIPTS -->
</body>
</html>
