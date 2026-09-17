<?php

namespace App\Controllers;

use \Config\Database;
use \Config\Services;
use CodeIgniter\HTTP\IncomingRequest;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;
use Psr\Log\LoggerInterface;

class Language extends BaseController
{

    public function index()
    {   $session = session();
        $locale = $this->request->getLocale();
        $session->remove('lang');
        $session->set('lang',$lang);
        $url = base_url();
        return redirect()->to($url);     
    }
}
